// This script is forked from https://gist.github.com/looeee/d02b567f18bf3d97a22022bf6b1282f5
// Use the generated lists to fetch the assets.
// No API key needed here

import path from "path";
import fs_ from "fs";
import { promises as fs } from "fs";
import { fileOrFolderExists, createDirectory, ASSETS_FILENAME } from "./utils.js";
import archiver from "archiver";

async function archiveModel(id, assetData) {
  const assetPath = `../assets/${id}/`;
  const archivePath = `../archives/${id}/`;
  const assetDataPath = `${assetPath}data.json`;
  const thumbnailPath = `${assetPath}thumbnail.png`;

  await createDirectory(archivePath);

  const thumbnailExists = await fileOrFolderExists(path.resolve(thumbnailPath));

  assetData = JSON.parse(await fs.readFile(assetDataPath));

  for (let i = 0; i < assetData.formats.length; i++) {
    const formatArchivePath = archivePath + `/${assetData.formats[i].formatType}.zip`;
    const archiveExists = await fileOrFolderExists(path.resolve(formatArchivePath));

    if (!archiveExists) {

      console.log('Archiving', formatArchivePath);
      

      const rootPath = `${assetPath}${assetData.formats[i].root.relativePath}`;

      const output = fs_.createWriteStream(formatArchivePath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });

      // output.on('close', function() {
      //   console.log(archive.pointer() + ' total bytes');
      //   console.log('archiver has been finalized and the output file descriptor has closed.');
      // });

      // output.on('end', function() {
      //   console.log('Data has been drained');
      // });

      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          process.kill();
          console.log(err);
        } else {
          throw err;
        }
      });

      archive.on('error', function(err) {
        process.kill();
        throw err;
      });

      archive.pipe(output);

      const licenseText = await fs.readFile('../LICENSE_CCBY.md', 'utf8');

      archive.append(licenseText.replace('CC-BY 3.0 License', `CC-BY 3.0 License ${assetData.authorName}`), { name: 'LICENSE.md' });
      archive.file(rootPath, { name: assetData.formats[i].root.relativePath });
      if (thumbnailExists) archive.file(thumbnailPath, { name: 'thumbnail.png' });

      if (assetData.formats[i].resources) for (let j = 0; j < assetData.formats[i].resources.length; j++) {
        const resource = assetData.formats[i].resources[j];
        archive.file(`${assetPath}${resource.relativePath}`, { name: resource.relativePath });
      }

      archive.finalize();
    }
  };
}

async function archiveAllModels() {
  console.log(`Archiving assets from assets.json`);
  const assets = JSON.parse(await fs.readFile(ASSETS_FILENAME));
  await createDirectory('../archives/');
  for (let key in assets) {
    await archiveModel(key, assets[key]).catch(console.error);
  }
}

archiveAllModels().catch(console.error);
