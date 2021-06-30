// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5

// Step 1: generate the lists. 
// Each fetched list contains 100 models
// These will be saved in assetsLists/assets_0.json, assetsLists/assets_0.json, assetsLists/assets_0.json etc.
// The lists only contain CC-BY models and no tilt brush models
// This will return >800 lists with 100 models in each. Refer here for ways to filter the list:
// https://developers.google.com/poly/reference/api/rest/v1/assets/list

import got from "got";
import { promises as fs } from "fs";
import { fileOrFolderExists, API_KEY, API_URL, POLY_VIEW_URL, ASSETS_FILENAME } from "./utils.js";

const CATEGORIES = [
  '',
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
async function getPage(pageToken, category) {
  console.log('Processing category', category || 'all', 'page', page);

  const rawAssetPage = await got(`${API_URL}?key=${API_KEY}&pageToken=${pageToken}&category=${category}&orderBy=NEWEST&pageSize=100`);
  const assetPage = JSON.parse(rawAssetPage.body);

  for (let i = 0; i < assetPage.assets.length; i++) {
    let asset = assetPage.assets[i];

    const id = asset.name.replace('assets/', '');

    const tags = [];
    if (tags && tags.indexOf(category) === -1) tags.push(category);

    const isTilt = asset.formats.find(asset => asset.formatType === 'TILT');
    const isBlocks = asset.description && asset.description.match(/blocks/i);
    if (isBlocks && tags.indexOf('blocks') === -1) {
      tags.push('blocks');
    }
    if (isTilt) {
      if (tags.indexOf('tilt') === -1) tags.push('tilt');
    } else {
      if (tags.indexOf('mesh') === -1) tags.push('mesh');
    }

    if (asset.isCurated && tags.indexOf('curated') === -1) {
      tags.push('curated');
    }

    const hashtags = asset.description && asset.description.match(/(^|\s)(#[a-z\d-]+)/gi);
    if (hashtags) for (let i = 0; i < hashtags.length; i++) {
      const tag = hashtags[i].replace(' ', '').replace('\n', '').replace('#', '');
      if (tags.indexOf(tag) === -1) tags.push(tag);
    }
    if (tags.indexOf('') !== -1) tags.splice(tags.indexOf(''), 1);

    const assetMatch = !!assets[id];

    if (!assetMatch) {
      console.log('Fetching additional data for', id);

      const htmlData = await got(`${POLY_VIEW_URL}/${id}`);
      const htmlText = String(htmlData.body);
      const likesMatch = htmlText.match(new RegExp('data-base-likes="(.[^"]+)"'));
      const likes = likesMatch ? Number(likesMatch[1]) : 0;
      const authorIdMatch = htmlText.match(new RegExp('(?<=<a href="\.\/user\/)[^"]*'));

      if (!authorIdMatch) console.log('Cannot find author for', id);
      const authorId = authorIdMatch ? authorIdMatch[0] : '';

      delete asset.name;
      delete asset.isCurated;
      delete asset.id;

      asset.license.replace('CREATIVE_COMMONS_BY', 'CCBY');

      asset = {
        name: asset.displayName,
        description: asset.description,
        authorId: authorId,
        authorName: asset.authorName,
        createTime: asset.createTime,
        updateTime: asset.updateTime,
        license: asset.license,
        visibility: asset.visibility,
        tags: tags,
        likes: likes,
        ...asset
      };

      if (asset.thumbnail) asset.thumbnail.relativePath = 'thumbnail.png';

      delete asset.displayName;

      assets[id] = asset;
    } else {
      delete assets[id].name;
      assets[id] = {
        name: asset.displayName,
        ...assets[id]
      }
    }
  }

  return assetPage.nextPageToken;
};

let page = 0;
let pageToken = '';
let assets = {};

async function getData() {
  console.log('Reading assets');
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }

  for (let i = 0; i < CATEGORIES.length; i++) {
    page = 0;
    pageToken = '';
    while ((pageToken || page === 0)) {
      pageToken = await getPage(pageToken, CATEGORIES[i]).catch(console.error);
      page++;
      if (page % 100 === 0) {
        console.log('Writing assets');
        await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
      }
    }
  }
  console.log('Writing assets');
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
}

getData().catch(console.error);
