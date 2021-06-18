import { promises as fs } from "fs";
import { fileOrFolderExists, ASSETS_FILENAME, USERS_FILENAME, TAGS_FILENAME } from "./utils.js";

let tags = {};
let users = {};
let assets = {};

async function process() {
  console.log('Reading tags, users and assets');
  if (await fileOrFolderExists(TAGS_FILENAME)) {
    tags = JSON.parse(await fs.readFile(TAGS_FILENAME)); 
  }
  if (await fileOrFolderExists(USERS_FILENAME)) {
    users = JSON.parse(await fs.readFile(USERS_FILENAME)); 
  }
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }
  console.log('Writing tags, users and assets');
  await fs.writeFile(TAGS_FILENAME, JSON.stringify(tags, null, 2));
  await fs.writeFile(USERS_FILENAME, JSON.stringify(users, null, 2));
  await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
}

process().catch(console.error);