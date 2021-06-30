import { promises as fs } from "fs";
import { fileOrFolderExists, ASSETS_FILENAME, USERS_CSV_FILENAME, TAGS_FILENAME, THUMBS_CSV_FILENAME } from "./utils.js";
import sharp from 'sharp';

let tags = {};
let users = {};
let assets = {};
let thumbs = {};

async function process() {
  console.log('Reading tags, users and assets');
  // if (await fileOrFolderExists(TAGS_FILENAME)) {
  //   tags = JSON.parse(await fs.readFile(TAGS_FILENAME)); 
  // }
  // if (await fileOrFolderExists(USERS_CSV_FILENAME)) {
  //   users = JSON.parse(await fs.readFile(USERS_CSV_FILENAME)); 
  // }
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }
  // if (await fileOrFolderExists(THUMBS_CSV_FILENAME)) {
  //   thumbs = JSON.parse(await fs.readFile(THUMBS_CSV_FILENAME)); 
  // }

  let i = 0;
  for (let id in assets) {
    console.log(id);
    i++;
    // if (i > 100) break;

    let thumbnailPath = `../assets/${id}/thumbnail.png`;
    let pngExists = await fileOrFolderExists(thumbnailPath);

    if (!pngExists) {
      thumbnailPath = `../images/thumbnail-missing.png`;
      pngExists = await fileOrFolderExists(thumbnailPath);
    }

    let jpegExists = false;//await fileOrFolderExists(`../assets/${id}/thumbnail-512.jpg`);
    if (pngExists && !jpegExists) await sharp(thumbnailPath)
    .resize(512)
    .jpeg({ mozjpeg: true, progressive: true, quality: 70 })
    .toFile(`../assets/${id}/thumbnail-512.jpg`, (err, info) => {})

    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-256.jpg`);
    if (pngExists && !jpegExists) await sharp(thumbnailPath)
    .resize(256)
    .jpeg({ mozjpeg: true, quality: 95 })
    .toFile(`../assets/${id}/thumbnail-256.jpg`, (err, info) => {})
    
    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-128.jpg`);
    if (pngExists && !jpegExists) await sharp(thumbnailPath)
    .resize(128)
    .jpeg({ mozjpeg: true, quality: 95 })
    .toFile(`../assets/${id}/thumbnail-128.jpg`, (err, info) => {})

    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-64.jpg`);
    if (pngExists && !jpegExists) await sharp(thumbnailPath)
      .resize(64)
      .jpeg({ mozjpeg: true, quality: 95 })
      .toFile(`../assets/${id}/thumbnail-64.jpg`, (err, info) => {})

    if (pngExists) await sharp(thumbnailPath) // && !thumbs[id]
      .resize(32)
      .jpeg({ mozjpeg: true, progressive: true, quality: 50 })
      .toBuffer((err, data, info) => {
        if (data) {
          const imgDataUri = data.toString('base64').replace('/9j/2wBDABAQEBAREBIUFBIZGxgbGSUiHx8iJTgoKygrKDhVNT41NT41VUtbSkVKW0uHal5eaoecg3yDnL2pqb3u4u7/////2wBDARAQEBAREBIUFBIZGxgbGSUiHx8iJTgoKygrKDhVNT41NT41VUtbSkVKW0uHal5eaoecg3yDnL2pqb3u4u7/////wgARCAAYACADASIAAhEBAxEB/8QA', '');
          thumbs[id] = imgDataUri;
        }
      });
  }
  // console.log(i);
  
  // console.log('Writing tags, users and assets');
  // await fs.writeFile(TAGS_FILENAME, JSON.stringify(tags, null, 2));
  // await fs.writeFile(USERS_CSV_FILENAME, JSON.stringify(users, null, 2));
  // await fs.writeFile(ASSETS_FILENAME, JSON.stringify(assets, null, 2));
  await fs.writeFile(THUMBS_CSV_FILENAME, JSON.stringify(thumbs, null, 2));
}

process().catch(console.error);