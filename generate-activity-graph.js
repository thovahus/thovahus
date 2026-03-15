// generate-activity-graph.js
import fs from "fs";
import axios from "axios";
import { themes } from "./themes.js";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN not set!");

const username = "thovahus";
const themeName = process.env.GRAPH_THEME || "react-dark"; // dynamic theme
const theme = themes[themeName];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// fetch last year of user events
async function fetchEvents() {
  let page = 1;
  const events = [];
  while (true) {
    const res = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: { Authorization: `token ${token}` },
      params: { per_page: 100, page }
    });
    if (!res.data.length) break;
    events.push(...res.data);
    page++;
  }
  return events;
}

// generate 7x52 matrix
function generateMatrix(events) {
  const matrix = Array.from({ length: 52 }, () => Array(7).fill(0));
  const now = new Date();
  for (const e of events) {
    const d = new Date(e.created_at);
    const weekDiff = Math.floor((now - d) / (7*24*60*60*1000));
    const day = d.getDay();
    if (weekDiff < 52) matrix[51 - weekDiff][day] += 1;
  }
  return matrix;
}

// map count to color
function getColor(count) {
  if (count === 0) return theme.colorLevels[0];
  if (count === 1) return theme.colorLevels[1];
  if (count === 2) return theme.colorLevels[2];
  if (count === 3) return theme.colorLevels[3];
  return theme.colorLevels[4];
}

// draw SVG
function drawSVG(matrix) {
  const cell = 12;
  const gap = 2;
  const width = 52 * (cell + gap);
  const height = 7 * (cell + gap) + 20; // top margin for month labels

  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="100%" height="100%" fill="${theme.background}"/>`;

  // month labels
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - m), 1);
    const week = Math.floor((now - monthDate) / (7*24*60*60*1000));
    const x = 51 - week;
    if (x >= 0 && x < 52) {
      svg += `<text x="${x*(cell+gap)}" y="12" font-size="12" fill="#888">${MONTHS[monthDate.getMonth()]}</text>`;
    }
  }

  // squares
  for (let w = 0; w < 52; w++) {
    for (let d = 0; d < 7; d++) {
      const x = w * (cell + gap);
      const y = d * (cell + gap) + 20;
      svg += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${getColor(matrix[w][d])}"/>`;
    }
  }

  svg += `</svg>`;
  fs.writeFileSync("graph.svg", svg);
}

(async () => {
  const events = await fetchEvents();
  const matrix = generateMatrix(events);
  drawSVG(matrix);
  console.log("graph.svg generated without native modules");
})();