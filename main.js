import dotenv from "dotenv";
import { Client } from "@notionhq/client";
// import fs from "fs";

import {
  getCategoriesAPI,
  getJWORGTokenAPI,
  getSubCategoriesAPI,
  getSubtitleAPI,
  getVideoListAPI,
} from "./requests.js";
import { LANGUAGE } from "./language.js";

dotenv.config();
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});
// console.log(process.env.NOTION_TOKEN);
// console.log(process.env.NOTION_DATABASE_ID);

let listOfExistingTitles = null;

const getListOfExistingTitles = async () => {
  let listOfExistingPages = [];
  let nextCursor = "";
  let hasMore = true;
  let currentPages = null;
  let pages = 0;

  console.log("Check exisitng pages...");
  currentPages = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
  });

  // console.log(currentPages.results[0].properties.Title.title[0].plain_text);
  listOfExistingPages = [...listOfExistingPages, ...currentPages.results];
  nextCursor = currentPages.next_cursor;
  hasMore = currentPages.has_more;
  // console.log(listOfExistingPages.length, nextCursor, hasMore);
  if (nextCursor != "") {
    pages = pages + currentPages.results.length;
    console.log(pages);
    while (hasMore) {
      // console.log(`has more pages: ${nextCursor}`);
      currentPages = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        start_cursor: nextCursor,
      });
      listOfExistingPages = [...listOfExistingPages, ...currentPages.results];
      nextCursor = currentPages.next_cursor;
      hasMore = currentPages.has_more;
      pages = pages + currentPages.results.length;
      console.log(pages);
    }
  }
  console.log(
    `Found ${listOfExistingPages.length} pages! Now making hashmap..`
  );
  listOfExistingTitles = null;
  listOfExistingTitles = await Object.fromEntries(
    listOfExistingPages.map((e) => [
      e.properties.Title.title[0].plain_text,
      true,
    ])
  );
};

const getJWORGToken = async () => {
  console.log("Getting Token from JW.ORG...");
  const token = await getJWORGTokenAPI();
  console.log("Got Token from JW.ORG!");
  const config = {
    headers: { Authorization: `Bearer ${token}` },
    Referer: "https://www.jw.org/",
  };
  console.log(config);
  return config;
};

const getCategories = async (config) => {
  console.log("Getting Video Categories...");
  const categories = await getCategoriesAPI(config);
  const categoiresNames = categories.map((category) => category.key);
  // console.log(categoiresNames);
  return categoiresNames;
};

const getSubCategories = async (config, category) => {
  console.log(`Getting Subcategories of ${category}...`);
  const subCategories = await getSubCategoriesAPI(category, config);
  const subCategoiresNames = subCategories.map(
    (subCategory) => subCategory.key
  );
  console.log(subCategoiresNames);

  return subCategoiresNames;
};

// ? Function to split text into chunks of max length
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

const createNotionPage = (
  title,
  category,
  subCategory,
  url,
  duration,
  date,
  chunks
) => {
  return notion.pages.create({
    parent: {
      database_id: process.env.NOTION_DATABASE_ID,
    },
    properties: {
      Title: {
        title: [{ text: { content: title } }],
      },
      Category: {
        multi_select: [{ name: LANGUAGE["KO"].CATEGORY[category] }],
      },
      "Sub Category": {
        multi_select: [
          { name: LANGUAGE["KO"].SUB_CATEGORY[category][subCategory] },
        ],
      },
      "Link to Video": {
        url: url,
      },
      Duration: {
        rich_text: [
          {
            type: "text",
            text: {
              content: duration,
              link: null,
            },
          },
        ],
      },
      "Upload Date": {
        date: {
          start: date,
        },
      },
    },
    children: [...chunks],
  });
};

const importToNotion = async (config, category, subCategory) => {
  // console.log(`Getting media list from ${subCategory}...`);
  const videoList = await getVideoListAPI(subCategory, config);
  console.log(
    `Found ${videoList.length} media from ${category}/${subCategory}`
  );

  // console.log("Importing to Notion...");
  let successRate = 0;
  let existRate = 0;
  // let failedVideo = ["Subtitles from below videos failed importing...\n"];
  for (let i = 0; i < videoList.length; i++) {
    const title = await videoList[i].title;
    const date = await videoList[i].firstPublished.split("T")[0];
    const url = `https://www.jw.org/${LANGUAGE["KO"].TWO_DIGITS}/${LANGUAGE["KO"].LIBRARY}/videos/#${LANGUAGE["KO"].TWO_DIGITS}/mediaitems/${subCategory}/${videoList[i].languageAgnosticNaturalKey}`;
    const duration = await videoList[i].durationFormattedHHMM;
    const subtitles = await videoList[i].files[0].subtitles;

    // console.log(title);
    if (!(title in listOfExistingTitles)) {
      // console.log(`Not Exists [${title}]`);
      if (subtitles) {
        successRate++;
        const vttURL = subtitles.url;
        const subtitle = await getSubtitleAPI(vttURL);
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
        await createNotionPage(
          title,
          category,
          subCategory,
          url,
          duration,
          date,
          chunks
        );
      } else {
        await createNotionPage(
          title,
          category,
          subCategory,
          url,
          duration,
          date,
          []
        );
        // failedVideo.push(`${i} ${title}`);
      }
    } else {
      existRate++;
      // console.log(`Already Exists ${title}`);
      // break;
    }
  }
  console.log(
    `Finished importing successRate ${successRate} out of ${
      videoList.length - existRate
    } (${existRate} already exists)`
  );
  // console.log(failedVideo);
  // if (failedVideo.length > 0) {
  //   fs.writeFile(
  //     `./error/${new Date().toISOString()}_${category}_${subCategory}_ERROR.txt`,
  //     failedVideo.join("\n"),
  //     (err) => {
  //       if (err) throw err;
  //     }
  //   );
  // }
};

const main = async () => {
  await getListOfExistingTitles();
  // console.log(listOfExistingTitles);

  const config = await getJWORGToken();
  const categories = await getCategories(config);
  console.log(categories);

  for (let i = 0; i < categories.length; i++) {
    const subCategories = await getSubCategories(config, categories[i]);

    for (let j = 0; j < subCategories.length; j++) {
      // console.log(categories[i], subCategories[j]);
      await importToNotion(config, categories[i], subCategories[j]);
    }
  }
};

main();
