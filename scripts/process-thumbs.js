import { promises as fs } from "fs";
import { fileOrFolderExists, ASSETS_FILENAME, THUMBS_CSV_FILENAME } from "./utils.js";
import sharp from 'sharp';

let assets = {};
let thumbs = '';

async function process() {
  console.log('Reading assets');
  if (await fileOrFolderExists(ASSETS_FILENAME)) {
    assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)); 
  }

  let i = 0;
  for (let id in assets) {
    i++;
    // if (i > 10) break;

    let thumbnailPath = `../assets/${id}/thumbnail.png`;
    let pngExists = await fileOrFolderExists(thumbnailPath);

    if (!pngExists) {
      thumbnailPath = `../images/thumbnail-missing.png`;
      pngExists = await fileOrFolderExists(thumbnailPath);
    }

    let jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-512.jpg`);
    if (pngExists && !jpegExists) {
      await sharp(thumbnailPath)
        .resize(512)
        .jpeg({ mozjpeg: true, progressive: true, quality: 70 })
        .toFile(`../assets/${id}/thumbnail-512.jpg`, (err, info) => {});
      console.log(`Saving: assets/${id}/thumbnail-512.jpg`);
    }

    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-256.jpg`);
    if (pngExists && !jpegExists) {
      await sharp(thumbnailPath)
        .resize(256)
        .jpeg({ mozjpeg: true, quality: 95 })
        .toFile(`../assets/${id}/thumbnail-256.jpg`, (err, info) => {});
      console.log(`Saving: assets/${id}/thumbnail-256.jpg`);
    }
    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-128.jpg`);
    if (pngExists && !jpegExists) {
      await sharp(thumbnailPath)
        .resize(128)
        .jpeg({ mozjpeg: true, quality: 95 })
        .toFile(`../assets/${id}/thumbnail-128.jpg`, (err, info) => {});
      console.log(`Saving: assets/${id}/thumbnail-128.jpg`);
    }

    jpegExists = await fileOrFolderExists(`../assets/${id}/thumbnail-64.jpg`);
    if (pngExists && !jpegExists) {
      await sharp(thumbnailPath)
        .resize(64)
        .jpeg({ mozjpeg: true, quality: 95 })
        .toFile(`../assets/${id}/thumbnail-64.jpg`, (err, info) => {});
      console.log(`Saving: assets/${id}/thumbnail-64.jpg`);
    }

    if (pngExists) await sharp(thumbnailPath)
      .resize(32)
      .jpeg({ mozjpeg: true, progressive: true, quality: 75 })
      .toBuffer((err, data, info) => {
        if (data) {
          const imgDataUri = data.toString('base64').replace('/9j/2wBDAAgICAgJCAkKCgkNDgwODRMREBARExwUFhQWFBwrGx8bGx8bKyYuJSMlLiZENS8vNUROQj5CTl9VVV93cXecnNH/2wBDAQgICAgJCAkKCgkNDgwODRMREBARExwUFhQWFBwrGx8bGx8bKyYuJSMlLiZENS8vNUROQj5CTl9VVV93cXecnNH/wgARCAAYACADASIAAhEBAxEB/', '');
          thumbs += `${id},${imgDataUri}\n`;
        }
      });
  }
  console.log(i);
  console.log('Writing', THUMBS_CSV_FILENAME);
  await fs.writeFile(THUMBS_CSV_FILENAME, thumbs);
}

process().catch(console.error);