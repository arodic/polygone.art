import path from "path";
import { promises as fs } from "fs";

export const API_KEY = "AIzaSyBRFURu4B9J-ZPIhcJmvZaxDmfKu7EMMuk";
export const API_URL = "https://poly.googleapis.com/v1/assets";
export const POLY_VIEW_URL = "https://poly.google.com/view";

export const ASSETS_FILENAME = '../data/assets.json';
export const ASSETS_CSV_FILENAME = '../data/assets.csv';
export const USERS_CSV_FILENAME = '../data/users.csv';
export const THUMBS_CSV_FILENAME = '../data/thumbs.csv';

export async function fileOrFolderExists(pathName) {
  try {
    await fs.access(pathName);
    return true;
  } catch {
    return false;
  }
}

export async function createDirectory(pathname) {
  if (!pathname.endsWith('/')) pathname = path.dirname(pathname);
  if (await fileOrFolderExists(pathname) === false) {
    await fs.mkdir(path.resolve(pathname), { recursive: true });
  }
}
