// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5
// Use the generated lists to fetch the assets.
// No API key needed here

import got from "got";
import path from "path";
import stream from "stream";
import fs_ from "fs";
import { promises as fs } from "fs";
import { fileOrFolderExists, createDirectory, ASSETS_FILENAME } from "./utils.js";
import { promisify } from "util";

const pipeline = promisify(stream.pipeline);

async function downloadModel(assetData) {
  const assetPath = `assets/${assetData.id}/`;
  const assetDataFilename = `${assetPath}data.json`;
  await createDirectory(assetDataFilename);

  const pipelines = [];

  const strippedAssetData = JSON.parse(JSON.stringify(assetData));

  if (assetData.thumbnail) {
    let thumbnailPath = `${assetPath}${assetData.thumbnail.relativePath}`;
    const thumbnailExists = await fileOrFolderExists(path.resolve(thumbnailPath));
    if (!thumbnailExists) {
      console.log(`Downloading thumbnail: ${thumbnailPath}`);
      pipelines.push(pipeline(
        got.stream(assetData.thumbnail.url),
        fs_.createWriteStream(thumbnailPath)
      ));
    }
    delete strippedAssetData.thumbnail.url;
  }

  for (let i = 0; i < assetData.formats.length; i++) {
    const rootPath = `${assetPath}${assetData.formats[i].root.relativePath}`;
    const rootExists = await fileOrFolderExists(path.resolve(rootPath));
    if (!rootExists) {
      await createDirectory(rootPath);
      console.log(`Downloading root asset: ${rootPath}`);
      pipelines.push(pipeline(
        got.stream(assetData.formats[i].root.url),
        fs_.createWriteStream(rootPath)
      ));
    }
    delete strippedAssetData.formats[i].root.url;
    if (assetData.formats[i].resources) for (let j = 0; j < assetData.formats[i].resources.length; j++) {
      const resource = assetData.formats[i].resources[j];
      let resourcePath = `${assetPath}${resource.relativePath}`;
      const resourceExists = await fileOrFolderExists(path.resolve(resourcePath));
      if (!resourceExists) {
        await createDirectory(resourcePath);
        console.log(`Downloading resources asset: ${resourcePath}`);
        pipelines.push(pipeline(
          got.stream(resource.url),
          fs_.createWriteStream(resourcePath)
        ));
      }
      delete strippedAssetData.formats[i].resources[j].url;
    }
  };

  console.log('Writing', assetDataFilename);
  await fs.writeFile(assetDataFilename, JSON.stringify(strippedAssetData, null, 4));

  await Promise.all(pipelines).catch((err) => {
    console.error(err)
  });
}

async function downloadAllModels() {
  console.log(`Downloading assets from assets.json`);
  const assets = JSON.parse(await fs.readFile(ASSETS_FILENAME)).assets;
  await createDirectory('assets');
  for (let i = 0; i < assets.length; i++) {
    await downloadModel(assets[i]).catch(console.error);
  }
}

downloadAllModels().catch(console.error);
