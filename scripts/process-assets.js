import { promises as fs } from "fs";
import { fileOrFolderExists, ASSETS_FILENAME, ASSETS_CSV_FILENAME, USERS_CSV_FILENAME } from "./utils.js";

let users = {};
let assets = {};
let assetsCsv = '';

async function process() {
  console.log('Reading assets');
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }

  let i = 0;
  for (let id in assets) {
    // console.log(id);
    i++;
    // if (i > 100) break;

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
  console.log(i);
  console.log('Writing assets');
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
  await fs.writeFile(ASSETS_CSV_FILENAME, assetsCsv);
  await fs.writeFile(USERS_CSV_FILENAME, usersCsv);
}

process().catch(console.error);