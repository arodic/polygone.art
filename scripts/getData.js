// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5

// Step 1: generate the lists. 
// Each fetched list contains 100 models
// These will be saved in assetsLists/assets_0.json, assetsLists/assets_0.json, assetsLists/assets_0.json etc.
// The lists only contain CC-BY models and no tilt brush models
// This will return >800 lists with 100 models in each. Refer here for ways to filter the list:
// https://developers.google.com/poly/reference/api/rest/v1/assets/list

import got from "got";
import { promises as fs } from "fs";
import { fileOrFolderExists, API_KEY, API_URL, POLY_VIEW_URL, ASSETS_FILENAME, ASSETS_CSV_FILENAME, USERS_CSV_FILENAME } from "./utils.js";

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

const PAGE_LIMIT = 2;

let assets = {};
let users = {};
let assetsCsv = '';

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

async function validateData() {
  console.log('Validating data...');

  let i = 0;
  for (let id in assets) {
    i++;

    const asset = assets[id];
    asset.license.replace('CREATIVE_COMMONS_BY', 'CCBY');

    if (asset.tags.indexOf('') !== -1) asset.tags.splice(asset.tags.indexOf(''), 1);

    if (asset.authorId === undefined) {
      console.error('Missing authorId');
      process.exit();
    }
    if (asset.isCurated && asset.tags.indexOf('curated') === -1) {
      console.error('Has isCurated');
      process.exit();
    }
    if (asset.name.indexOf('assets/') !== -1) {
      console.error('Wrong name field', asset.name);
      process.exit();
    }
    delete asset.isCurated;

    assetsCsv += `${id},${asset.authorId},${asset.name}`;
    for (let i = 0; i < asset.tags.length; i++) {
      assetsCsv += `,${asset.tags[i]}`;
    }
    assetsCsv += '\n';

    users[asset.authorId] = users[asset.authorId] || {
      name: asset.authorName,
      assets: []
    };
    if (users[asset.authorId].assets.indexOf(id) === -1) users[asset.authorId].assets.push(id);
  }

  let usersCsv = '';

  for (let id in users) {
    usersCsv += `${id},${users[id].name}`;
    for (let i = 0; i < users[id].assets.length; i++) {
      usersCsv += `,${users[id].assets[i]}`;
    }
    usersCsv += '\n';
  }
  console.log('Total asset count:', i);
  console.log('Writing', ASSETS_FILENAME);
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
  console.log('Writing', ASSETS_CSV_FILENAME);
  await fs.writeFile(ASSETS_CSV_FILENAME, assetsCsv);
  console.log('Writing', USERS_CSV_FILENAME);
  await fs.writeFile(USERS_CSV_FILENAME, usersCsv);
}

let page = 0;
let pageToken = '';

async function getData() {
  console.log('Reading assets');
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }
  for (let i = 0; i < CATEGORIES.length; i++) {
    page = 0;
    pageToken = '';
    while ((pageToken || page === 0) && page < PAGE_LIMIT) {
      pageToken = await getPage(pageToken, CATEGORIES[i]).catch(console.error);
      page++;
      if (page % 100 === 0) {
        console.log('Writing', ASSETS_FILENAME);
        await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
      }
    }
  }
  validateData().catch(console.error);;
}

getData().catch(console.error);
