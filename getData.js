// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5
// Step 1: generate the lists. 
// Each fetched list contains 100 models
// These will be saved in assetsLists/assets_0.json, assetsLists/assets_0.json, assetsLists/assets_0.json etc.
// The lists only contain CC-BY models and no tilt brush models
// This will return >800 lists with 100 models in each. Refer here for ways to filter the list:
// https://developers.google.com/poly/reference/api/rest/v1/assets/list

import got from "got";
import { promises as fs } from "fs";
import { fileOrFolderExists, createDirectory, API_KEY, API_URL, POLY_VIEW_URL } from "./utils.js";

// Get an API key here
// https://developers.google.com/poly/develop/api
const ASSETS_FILENAME = 'assets.json';
const USERS_FILENAME = 'users.json';

async function getModelLists(pageToken = "") {
  const rawAssetPage = await got(`${API_URL}?key=${API_KEY}&pageToken=${pageToken}&orderBy=BEST&pageSize=100`);
  const assetPage = JSON.parse(rawAssetPage.body);
  const assets = assetPage.assets;

  for (let i = 0; i < assets.length; i++) {

    const id = assets[i].name.replace('assets/', '');
    const assetDataFilename = `assets/${id}/data.json`;

    const savedAssetData = await fileOrFolderExists(assetDataFilename) && JSON.parse(await fs.readFile(assetDataFilename));

    const assetIDMatches = assetsData.assets.filter(asset => asset.id === id);
    let assetData = assetIDMatches[0];

    if (!assetData) {
      if (savedAssetData) {
        console.log('Restored asset data from file', id);
        assetData = savedAssetData;
        assetsData.assets.push(assetData);
      } else {
        assetData = assets[i];
        console.log('Fetching additional data for', id);
        const htmlData = await got(`${POLY_VIEW_URL}/${id}`);
        const htmlText = String(htmlData.body);
        const likesMatch = htmlText.match(new RegExp('data-base-likes="(.[^"]+)"'));
        const likes = likesMatch ? Number(likesMatch[1]) : 0;
        const authorIdMatch = htmlText.match(new RegExp('(?<=<a href="\.\/user\/)[^"]*'));

        if (!authorIdMatch) console.log('Cannot find author for', id);
        const authorId = authorIdMatch ? authorIdMatch[0] : '';

        assetData = {
          id: id,
          name: assets[i].displayName,
          description: assets[i].description,
          authorId: authorId,
          authorName: assets[i].authorName,
          createTime: assets[i].createTime,
          updateTime: assets[i].updateTime,
          license: assets[i].license,
          visibility: assets[i].visibility,
          category: "",
          likes: likes,
          isCurated: assets[i].isCurated || false,
          ...assets[i]
        };

        delete assetData.name;
        delete assetData.displayName;

        assetsData.assets.push(assetData);

        console.log('Writing', assetDataFilename);
        await createDirectory(assetDataFilename);
        await fs.writeFile(assetDataFilename, JSON.stringify(assetData, null, 4));
      }
    } else if (!savedAssetData) {
      console.log('Writing', assetDataFilename);
      await createDirectory(assetDataFilename);
      await fs.writeFile(assetDataFilename, JSON.stringify(assetData, null, 4));
    }

    const usersIDMatches = usersData.users.filter(user => user.id === assetData.authorId);
    let user = usersIDMatches[0];

    if (user) {
      if (user.assets.indexOf(id) === -1) user.assets.push(id);
    } else {
      usersData.users.push({
        id: assetData.authorId,
        name: assetData.authorName,
        assets: [id]
      });
    }
  }

  return assetPage.nextPageToken;
};

let page = 0;
let pageToken = '';
let assetsData = {
  assets: []
};

let usersData = {
  users: []
};

async function getAllModelLists() {
  console.log('Reading assetsData and usersData');
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assetsData = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }
  if (await fileOrFolderExists(USERS_FILENAME)) {
    usersData = JSON.parse(await fs.readFile(USERS_FILENAME)); 
  }

  while (pageToken || page === 0) {
    pageToken = await getModelLists(pageToken).catch(console.error);
    if (page % 100 === 0) {
      console.log('Processing page', page);
      console.log('Writing assetsData and usersData');
      await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assetsData, null, 4));
      await fs.writeFile(USERS_FILENAME, JSON.stringify(usersData, null, 4));
    }
    page++;
  }

  console.log('Writing assetsData and usersData');
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assetsData, null, 4));
  await fs.writeFile(USERS_FILENAME, JSON.stringify(usersData, null, 4));
}

getAllModelLists().catch(console.error);
