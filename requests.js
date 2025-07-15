import axios from "axios";

const language = "KO";
// const language = "E";

export const getJWORGTokenAPI = async () => {
  const value = await axios.get(`https://b.jw-cdn.org/tokens/jworg.jwt`);
  return value.data;
};

export const getCategoriesAPI = async (config) => {
  const value = await axios.get(
    `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/VideoOnDemand?detailed=1&mediaLimit=0&clientType=www`,
    config
  );
  return value.data.category.subcategories;
};

export const getSubCategoriesAPI = async (category, config) => {
  const value = await axios.get(
    `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/${category}?detailed=1&mediaLimit=0&clientType=www`,
    config
  );
  return value.data.category.subcategories;
};

export const getVideoListAPI = async (subCategory, config) => {
  const value = await axios.get(
    `https://b.jw-cdn.org/apis/mediator/v1/categories/${language}/${subCategory}?detailed=1&clientType=www`,
    config
  );

  return value.data.category.media;
};

export const getSubtitleAPI = async (videoVttAddress) => {
  const value = await axios.get(videoVttAddress);
  return value.data;
};
