import fs from 'fs';
import axios from 'axios';
import { createCanvas } from 'canvas';
import { themes } from './themes.js';

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN not set!");

const username = "thovahus";
const themeName = "react-dark"; // pick your theme
const theme = themes[themeName];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// fetch last year events
async function fetchEvents() {
  const events = [];
  let page = 1;
  while (true) {
    const res = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json'
      },
      params: { per_page: 100, page }
    });
    if (res.data.length === 0) break;
    events.push(...res.data);
    page++;
  }
  return events;
}

// convert events to 7x52 matrix
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

// map count to theme color
function getColor(count) {
  if (count === 0) return theme.colorLevels[0];
  if (count === 1) return theme.colorLevels[1];
  if (count === 2) return theme.colorLevels[2];
  if (count === 3) return theme.colorLevels[3];
  return theme.colorLevels[4];
}

// draw SVG locally with month labels
function drawGraph(matrix) {
  const cell = 12;
  const gap = 2;
  const width = 52 * (cell + gap);
  const height = 7 * (cell + gap) + 20; // extra space for month labels

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // month labels
  ctx.fillStyle = "#888"; // subtle gray
  ctx.font = "12px sans-serif";
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (11 - m), 1);
    const week = Math.floor((now - monthDate) / (7*24*60*60*1000));
    const x = 51 - week;
    if (x >= 0 && x < 52) {
      ctx.fillText(MONTHS[monthDate.getMonth()], x*(cell+gap), 12);
    }
  }

  // squares
  for (let w = 0; w < 52; w++) {
    for (let d = 0; d < 7; d++) {
      ctx.fillStyle = getColor(matrix[w][d]);
      ctx.fillRect(w*(cell+gap), d*(cell+gap) + 20, cell, cell); // offset for month labels
    }
  }

  fs.writeFileSync('graph.svg', canvas.toBuffer('image/svg+xml'));
}

(async () => {
  const events = await fetchEvents();
  const matrix = generateMatrix(events);
  drawGraph(matrix);
  console.log("graph.svg generated with month labels");
})();