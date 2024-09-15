import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import { Client } from "@notionhq/client";

dotenv.config();
// console.log(process.env.NOTION_TOKEN);
// console.log(process.env.NOTION_DATABASE_ID);

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const language = "KO";
// const language = "E";

// const urlForJWORGToken = [`https://b.jw-cdn.org/tokens/jworg.jwt`];

// const urlForCategories = [
//   `https://b.jw-cdn.org/apis/mediator/v1/categories/E/VideoOnDemand`,
//   { detailed: 1, clientType: "www", mediaLimit: 0 },
// ];

// const urlForSubCategories = [
//   `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/VODProgramsEvents`,
//   { detailed: 1, clientType: "www", mediaLimit: 0 },
// ];

// const urlForMorningWorship = [
//   `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/VODPgmEvtMorningWorship`,
//   { detailed: 1, clientType: "www" },
// ];

const getJWORGToken = () => {
  return axios.get(`https://b.jw-cdn.org/tokens/jworg.jwt`).then((value) => {
    return value.data;
  });
};

const getCategories = (config) => {
  return axios
    .get(
      `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/VideoOnDemand?detailed=1&mediaLimit=0&clientType=www`,
      config
    )
    .then((value) => {
      return value.data.category.subcategories;
    });
};

const getSubCategores = (category, config) => {
  return axios
    .get(
      `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/${category}?detailed=1&mediaLimit=0&clientType=www`,
      config
    )
    .then((value) => {
      return value.data.category.subcategories;
    });
};

const getVideoList = (subCategory, config) => {
  return axios
    .get(
      `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/${subCategory}?detailed=1&clientType=www`,
      config
    )
    .then((value) => {
      return value.data.category.media;
    });
};

const getSubtitle = (videoVttAddress) => {
  return axios.get(videoVttAddress).then((value) => {
    return value.data;
  });
};

// Function to split text into chunks of max length
const splitIntoChunks = (text, maxLength) => {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    const chunk = {
      object: "block",
      paragraph: {
        rich_text: [
          {
            text: {
              content: text.slice(i, i + maxLength),
            },
          },
        ],
        color: "default",
      },
    };
    // console.log(chunk.paragraph.rich_text[0].text.content);
    chunks.push(chunk);
  }
  return chunks;
};

const createNotionPage = (title, date, chunks) => {
  return notion.pages.create({
    parent: {
      database_id: process.env.NOTION_DATABASE_ID,
    },
    properties: {
      Title: {
        title: [{ text: { content: title } }],
      },
      Category: {
        multi_select: [{ name: "Broadcasting" }],
      },
      "Sub Category": {
        multi_select: [{ name: "Talk" }],
      },
      "Start Date": {
        date: {
          start: date,
        },
      },
      "End Date": {
        date: {
          start: date,
        },
      },
    },
    children: [...chunks],
  });
};

const main = async () => {
  console.log("Getting Token from JW.ORG...");
  const token = await getJWORGToken();
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    Referer: "https://www.jw.org/",
  };
  console.log("Got Token from JW.ORG!");

  console.log("Getting Video Categories...");
  const categories = await getCategories(config);
  const categoiresNames = categories.map((category) => category.key);
  console.log(categoiresNames);

  // Sample Video Category
  const selectedCategory = categoiresNames[0];

  console.log(`Getting Subcategories of ${selectedCategory}...`);
  const subCategories = await getSubCategores(selectedCategory, config);
  const subCategoiresNames = subCategories.map(
    (subCategory) => subCategory.key
  );
  console.log(subCategoiresNames);

  // Sample Video Category
  const selectedSubCategory = subCategoiresNames[2];

  console.log(`Getting media list from ${selectedSubCategory}...`);
  const videoList = await getVideoList(selectedSubCategory, config);
  console.log(`Found ${videoList.length - 1} media!`);

  console.log("Importing to Notion...");
  let successRate = 0;
  let failedVideo = ["Subtitles from below videos failed importing...\n"];
  for (let i = 0; i < videoList.length; i++) {
    const title = await videoList[i].title;
    const date = await videoList[i].firstPublished.split("T")[0];
    const subtitles = await videoList[i].files[0].subtitles;

    if (subtitles) {
      successRate++;
      const vttURL = subtitles.url;
      const subtitle = await getSubtitle(vttURL);
      const cleanSubtitle = subtitle
        .replace(
          // Match all specified timestamp formats and optional additional information
          /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}(?: line:[^ \n]* position:[^ \n]* align:[^\n]*)?|\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g,
          " "
        )
        .replace(/WEBVTT/, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const chunks = splitIntoChunks(cleanSubtitle, 1999);

      fs.writeFile(`./subtitles/${i}_${title}.txt`, cleanSubtitle, (err) => {
        if (err) throw err;
      });

      await createNotionPage(title, date, chunks);
    } else {
      failedVideo.push(`${i} ${title}`);
    }
  }
  console.log(
    `Finished importing successRate ${successRate} out of ${
      videoList.length - 1
    } ! Thank you for waiting 🙂`
  );
  // console.log(failedVideo);
  if (failedVideo.length > 0) {
    fs.writeFile(
      `./error/${new Date().toISOString()}_${selectedCategory}_${selectedSubCategory}_ERROR.txt`,
      failedVideo.join("\n"),
      (err) => {
        if (err) throw err;
      }
    );
  }
};

main();
