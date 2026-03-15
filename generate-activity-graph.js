// generate-activity-graph.js
import fs from 'fs';
import fetch from 'node-fetch';
import { themes } from './themes.js';

const GITHUB_TOKEN = process.env.PAT_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME;
const GRAPH_THEME = process.env.GRAPH_THEME || 'react-dark';

if (!GITHUB_TOKEN) throw new Error('PAT_TOKEN is required for private repo access');
if (!USERNAME) throw new Error('Set GITHUB_USERNAME environment variable');

const THEME = themes[GRAPH_THEME];
if (!THEME) throw new Error(`Theme ${GRAPH_THEME} not found in themes.js`);

async function fetchRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&visibility=all&affiliation=owner`,
      { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

async function fetchContributions(repo) {
  const res = await fetch(
    `https://api.github.com/repos/${USERNAME}/${repo.name}/commits?author=${USERNAME}&per_page=100`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
  );
  if (!res.ok) return [];
  const commits = await res.json();
  return commits.map(c => new Date(c.commit.author.date));
}

function generateSVG(contributions) {
  const days = {};
  contributions.forEach(date => {
    const day = date.toISOString().split('T')[0];
    days[day] = (days[day] || 0) + 1;
  });

  const colorLevels = THEME.colorLevels;
  const boxSize = 10;
  const padding = 2;
  const width = 53 * (boxSize + padding);
  const height = 7 * (boxSize + padding);

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:${THEME.background}">`;

  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);

  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      const current = new Date(start);
      current.setDate(start.getDate() + week * 7 + day);
      const key = current.toISOString().split('T')[0];
      const count = days[key] || 0;
      const color = count === 0 ? colorLevels[0] : colorLevels[Math.min(count, colorLevels.length - 1)];
      svg += `<rect x="${week * (boxSize + padding)}" y="${day * (boxSize + padding)}" width="${boxSize}" height="${boxSize}" fill="${color}" />`;
    }
  }
  svg += '</svg>';
  return svg;
}

(async () => {
  try {
    const repos = await fetchRepos();
    const allDates = [];

    for (const repo of repos) {
      const commits = await fetchContributions(repo);
      allDates.push(...commits);
    }

    const svg = generateSVG(allDates);
    fs.writeFileSync('./graph.svg', svg);
    console.log(`Activity graph generated: ${GRAPH_THEME}`);
  } catch (err) {
    console.error('Error generating activity graph:', err);
    process.exit(1);
  }
})();