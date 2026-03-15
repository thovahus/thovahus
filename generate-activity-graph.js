// generate-activity-graph.js
import fs from 'fs';
import fetch from 'node-fetch';
import { themes } from './themes.js';

const GITHUB_TOKEN = process.env.STATS_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME;
const GRAPH_THEME = process.env.GRAPH_THEME || 'react-dark';

if (!GITHUB_TOKEN) throw new Error('STATS_TOKEN is required for private repo access');
if (!USERNAME) throw new Error('Set GITHUB_USERNAME environment variable');

const THEME = themes[GRAPH_THEME];
if (!THEME) throw new Error(`Theme ${GRAPH_THEME} not found in themes.js`);

async function fetchContributionCalendar() {
  const query = `{
    user(login: "${USERNAME}") {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL error: ${json.errors[0].message}`);
  return json.data.user.contributionsCollection.contributionCalendar;
}

function computeStats(weeks) {
  const allDays = weeks.flatMap(w => w.contributionDays).sort((a, b) => a.date.localeCompare(b.date));
  const total = allDays.reduce((sum, d) => sum + d.contributionCount, 0);

  let longestStreak = 0, streak = 0;
  for (const day of allDays) {
    streak = day.contributionCount > 0 ? streak + 1 : 0;
    longestStreak = Math.max(longestStreak, streak);
  }

  const today = new Date().toISOString().split('T')[0];
  const reversed = [...allDays].reverse();
  let i = (reversed[0]?.date === today && reversed[0]?.contributionCount === 0) ? 1 : 0;
  let currentStreak = 0;
  for (; i < reversed.length; i++) {
    if (reversed[i].contributionCount > 0) currentStreak++;
    else break;
  }

  return { total, longestStreak, currentStreak };
}

function generateSVG(calendar) {
  const { weeks } = calendar;
  const { colorLevels, labelColor, glowColor } = THEME;
  const r = 5;
  const cellSize = r * 2 + 3;
  const leftMargin = 32;
  const topMargin = 24;
  const bottomMargin = 46;
  const gridW = weeks.length * cellSize;
  const gridH = 7 * cellSize;
  const totalW = leftMargin + gridW + 14;
  const totalH = topMargin + gridH + bottomMargin;

  const font = `font-family="'Segoe UI', system-ui, sans-serif" font-size="10" fill="${labelColor}"`;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  const stats = computeStats(weeks);

  let svg = `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg" style="background:transparent">`;

  svg += `<defs><filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>`;

  // Month labels
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const m = new Date(weeks[w].contributionDays[0].date).getMonth();
    if (m !== lastMonth) {
      svg += `<text x="${leftMargin + w * cellSize + r}" y="${topMargin - 7}" ${font}>${MONTHS[m]}</text>`;
      lastMonth = m;
    }
  }

  // Day labels
  for (let d = 0; d < 7; d++) {
    if (DAY_LABELS[d]) {
      svg += `<text x="${leftMargin - 5}" y="${topMargin + d * cellSize + r + 3}" text-anchor="end" ${font}>${DAY_LABELS[d]}</text>`;
    }
  }

  // Circles
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < weeks[w].contributionDays.length; d++) {
      const { contributionCount } = weeks[w].contributionDays[d];
      const level = contributionCount === 0 ? 0 : Math.min(Math.ceil(contributionCount / 2), colorLevels.length - 1);
      const cx = leftMargin + w * cellSize + r;
      const cy = topMargin + d * cellSize + r;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colorLevels[level]}"${level >= 3 ? ` filter="url(#glow)"` : ''}/>` ;
    }
  }

  // Stats row
  const statsY = topMargin + gridH + 18;
  svg += `<text x="${leftMargin}" y="${statsY}" ${font} font-weight="600">${stats.total} contributions</text>`;
  svg += `<text x="${leftMargin + 118}" y="${statsY}" ${font}>${stats.currentStreak}d streak</text>`;
  svg += `<text x="${leftMargin + 192}" y="${statsY}" ${font}>${stats.longestStreak}d best</text>`;

  // Legend
  const legendY = statsY + 14;
  svg += `<text x="${leftMargin}" y="${legendY + r}" ${font}>Less</text>`;
  for (let i = 0; i < colorLevels.length; i++) {
    svg += `<circle cx="${leftMargin + 28 + i * cellSize + r}" cy="${legendY}" r="${r}" fill="${colorLevels[i]}"/>` ;
  }
  svg += `<text x="${leftMargin + 28 + colorLevels.length * cellSize + r + 4}" y="${legendY + r}" ${font}>More</text>`;

  svg += '</svg>';
  return svg;
}

(async () => {
  try {
    const calendar = await fetchContributionCalendar();
    const svg = generateSVG(calendar);
    fs.writeFileSync('./graph.svg', svg);
    console.log(`Graph generated: ${GRAPH_THEME} (${calendar.totalContributions} contributions)`);
  } catch (err) {
    console.error('Error generating activity graph:', err);
    process.exit(1);
  }
})();