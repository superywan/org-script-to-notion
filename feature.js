const NOTION_DATABASE_ID = "NOTION_DATABASE_ID";
const INTERNAL_INTEGRATION_SECRET = "INTERNAL_INTEGRATION_SECRET";

export const getInformationsOnLocalStorage = () => {
  console.log("getInformationsOnLocalStorage!");
  const notionDatabaseId = localStorage.getItem(NOTION_DATABASE_ID) && "";
  const internalIntegrationSecret =
    localStorage.getItem(INTERNAL_INTEGRATION_SECRET) && "";
  return { notionDatabaseId, internalIntegrationSecret };
};

export const setInformationsOnLocalStorage = (
  notionDatabaseId,
  internalIntegrationSecret
) => {
  localStorage.setItem(NOTION_DATABASE_ID, notionDatabaseId);
  localStorage.setItem(INTERNAL_INTEGRATION_SECRET, internalIntegrationSecret);
};

export const appendLogOnTextarea = (log) => {
  const logElement = document.querySelector("#log");
  const currentLogElementValue = logElement.value;
  logElement.value = currentLogElementValue + log + "\r\n";
};
