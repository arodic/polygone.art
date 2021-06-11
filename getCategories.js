// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5

// Step 1: generate the lists. 
// Each fetched list contains 100 models
// These will be saved in assetsLists/assets_0.json, assetsLists/assets_0.json, assetsLists/assets_0.json etc.
// The lists only contain CC-BY models and no tilt brush models
// This will return >800 lists with 100 models in each. Refer here for ways to filter the list:
// https://developers.google.com/poly/reference/api/rest/v1/assets/list

import got from "got";
import { promises as fs } from "fs";
import { fileOrFolderExists, API_KEY, API_URL } from "./utils.js";

const CATEGORIES = [
  'blocks',
  'animals',
  'architecture',
  'art',
  'culture',
  'food',
  'history',
  'nature',
  'objects',
  'people',
  'scenes',
  'science',
  'tech',
  'transport',
  'travel',
];

// Get an API key here
// https://developers.google.com/poly/develop/api
const ASSETS_FILENAME = 'assets.json';

async function geCategoryLists(pageToken, category) {
  console.log('Processing category page', category, page);

  const rawAssetPage = await got(`${API_URL}?key=${API_KEY}&pageToken=${pageToken}&category=${category}&pageSize=100`);
  const assetPage = JSON.parse(rawAssetPage.body);
  const assets = assetPage.assets;

  for (let i = 0; i < assets.length; i++) {

    const id = assets[i].name.replace('assets/', '');
    const assetDataFilename = `assets/${id}/data.json`;

    if (categoryList.assets.indexOf(id) === -1) {
      categoryList.assets.push(id);
    }

    const asset = assetsData.assets.find(asset => asset.id === id);
    asset.category = category;

    await fs.writeFile(assetDataFilename, JSON.stringify(asset, null, 4));
  }

  return assetPage.nextPageToken;
};

let page = 0;
let pageToken = '';
let assetsData = {
  assets: []
};

let allCategoryList = {
  assets: []
};
let categoryList = {
  assets: []
};

async function getCategories() {
  console.log('Reading assetsData');
  assetsData = JSON.parse(await fs.readFile(ASSETS_FILENAME));

  if (await fileOrFolderExists('category_all.json')) {
    allCategoryList = JSON.parse(await fs.readFile('category_all.json')); 
  } else {
    for (let i = 0; i < assetsData.assets.length; i++) {
      allCategoryList.assets.push(assetsData.assets[i].id);
    }
  }


  for (let i = 0; i < CATEGORIES.length; i++) {
    console.log('Processing category', CATEGORIES[i]);
    page = 0;
    pageToken = '';
    const categoryFilename = `category_${CATEGORIES[i]}.json`;
    categoryList.assets.length = 0;
    categoryList = await fileOrFolderExists(categoryFilename) && JSON.parse(await fs.readFile(categoryFilename)) || categoryList;
    while (pageToken || page === 0) {
      pageToken = await geCategoryLists(pageToken, CATEGORIES[i]).catch(console.error);
      page++;
    }
    console.log('Writing data for', CATEGORIES[i], categoryList.assets.length);
    await fs.writeFile(categoryFilename, JSON.stringify(categoryList, null, 4));
  }

  console.log('Writing category_all.json', allCategoryList.assets.length);
  await fs.writeFile('category_all.json', JSON.stringify(allCategoryList, null, 4));

  const assets = assetsData.assets.filter(asset => !asset.category);
  if (assets.length) {
    console.warn(assets.length, 'asset without catgegory!');
  }

  console.log('Writing assetsData');
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assetsData, null, 4));
}

getCategories().catch(console.error);
