// Use the generated lists to fetch the assets.
// No API key needed here

const promisify = require("util").promisify;
const stream = require("stream");
const fs_ = require("fs");
const fs = require("fs").promises;
const got = require("got");
const path = require("path");
const sanitize = require("sanitize-filename");

const pipeline = promisify(stream.pipeline);

async function createDirectory(pathname) {
  if (!pathname.endsWith('/')) pathname = path.dirname(pathname);
  if (await fileOrfolderExists(pathname) === false) {
    await fs.mkdir(path.resolve(pathname), { recursive: true });
  }
}

async function fileOrfolderExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

async function fetchModel(name, modelPath, assetData) {
  const dirExists = await fileOrfolderExists(modelPath);
  if (!dirExists) {
    console.log(`Fetching model: ${name}`);
    await createDirectory(modelPath);
  }

  const jsonExists = await fileOrfolderExists(path.resolve(`${modelPath}data.json`));
  if (!jsonExists) {
    console.log(`Writing data: ${modelPath}data.json`);
    await fs.writeFile(`${modelPath}data.json`, JSON.stringify(assetData, null, 4));
  }

  const pipelines = [];

  if (assetData.thumbnail) {
    const thumbnailPath = `${modelPath}${assetData.thumbnail.relativePath}`;
    const thumbnailExists = await fileOrfolderExists(path.resolve(thumbnailPath));
    if (!thumbnailExists) {
      console.log(`Fetching thumbnail: ${thumbnailPath}`);
      pipelines.push(pipeline(
        got.stream(assetData.thumbnail.url),
        fs_.createWriteStream(thumbnailPath)
      ));
    }
  }

  for (const format of assetData.formats) {
    const rootPath = `${modelPath}${format.root.relativePath}`;
    const rootExists = await fileOrfolderExists(path.resolve(rootPath));
    if (!rootExists) {
      await createDirectory(rootPath);
      console.log(`Fetching root asset: ${rootPath}`);
      pipelines.push(pipeline(
        got.stream(format.root.url),
        fs_.createWriteStream(rootPath)
      ));
    }
    if (format.resources) for (const resource of format.resources) {
      let resourcePath = `${modelPath}${resource.relativePath}`;
      const resourceExists = await fileOrfolderExists(path.resolve(resourcePath));
      if (!resourceExists) {
        await createDirectory(resourcePath);
        console.log(`Fetching resources asset: ${resourcePath}`);
        pipelines.push(pipeline(
          got.stream(resource.url),
          fs_.createWriteStream(resourcePath)
        ));
      }
    }
  };

  await Promise.all(pipelines).catch((err) => {
    console.error(err)
  });

}

async function getModelsFromList(assetsList, page) {
  for (const assetData of assetsList.assets) {
    const name = sanitize(assetData.name.replace('assets/', ''));
    const modelPath = `./models/${page}/${name}/`;
    await fetchModel(name, modelPath, assetData).catch((err) => {
      console.error(err);
    });
  }
}

let page = Number(process.env.PAGE_START) || 0;
let lastPage = Number(process.env.PAGE_END) || Infinity;
const baseFile = "assetsLists/assets_";

async function getAllModels() {
  await createDirectory("models");
  const listPath = `${baseFile}${page}.json`;
  if (await fileOrfolderExists(listPath) && page <= lastPage) {
    console.log(`Loading models from: ${listPath}`);
    const rawData = await fs.readFile(listPath);
    const assetsList = JSON.parse(rawData);
    await getModelsFromList(assetsList, page).catch((err) => {
      console.error(err);
    });
    page++;
    await getAllModels().catch((err) => console.error(err));
  } else {
    console.log("No more files! You did it! :D");
  }
}

getAllModels().catch((err) => console.error(err));
