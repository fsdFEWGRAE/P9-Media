import express from "express";
import axios from "axios";
import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";

// ---------------- CONFIG (بدون أسرار) ----------------
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const {
  mediaChannel,
  youtubeChannelId,
  tiktokUsername,
  checkInterval
} = config;

// ---------------- ENV (من Render Secrets) ----------------
const token = process.env.token;                
const youtubeApiKey = process.env.youtubeApiKey;

if (!token) console.log("❌ ERROR: Missing token in Render ENV");
if (!youtubeApiKey) console.log("❌ ERROR: Missing youtubeApiKey in Render ENV");

// ---------------- DISCORD CLIENT ----------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ---------------- KEEP ALIVE (Render) ----------------
const app = express();
app.get("/", (req, res) => res.send("Media Bot Running!"));
app.listen(process.env.PORT || 3000);

// ---------------- CACHE ----------------
let lastYoutubeVideo = "";
let lastTikTokVideo = "";

// ===================================================================
//                    📌 SEND YOUTUBE MESSAGE
// ===================================================================
async function sendYouTube(title, link, thumbnail) {
  const channel = client.channels.cache.get(mediaChannel);
  if (!channel) return console.log("❌ Media channel not found!");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🎬 مشاهدة على اليوتيوب")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await channel.send({
    content: "@everyone",
    embeds: [
      {
        title: "🎥 فيديو جديد على اليوتيوب!",
        description: `**${title}**`,
        url: link,
        color: 0xff0000, 
        image: { url: thumbnail },
        footer: { text: "YouTube Auto Poster" }
      }
    ],
    components: [row]
  });

  console.log("📢 YouTube Sent:", title);
}

// ===================================================================
//                    📌 SEND TIKTOK MESSAGE
// ===================================================================
async function sendTikTok(title, link, thumbnail) {
  const channel = client.channels.cache.get(mediaChannel);
  if (!channel) return console.log("❌ Media channel not found!");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("🎵 مشاهدة على تيك توك")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await channel.send({
    content: "@everyone",
    embeds: [
      {
        title: "🎵 مقطع جديد على تيك توك!",
        description: `**${title}**`,
        url: link,
        color: 0x00ffff,
        image: { url: thumbnail },
        footer: { text: "TikTok Auto Poster" }
      }
    ],
    components: [row]
  });

  console.log("📢 TikTok Sent:", title);
}

// ===================================================================
//                    📌 CHECK YOUTUBE
// ===================================================================
async function checkYouTube() {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${youtubeApiKey}&channelId=${youtubeChannelId}&order=date&part=snippet&type=video&maxResults=1`;
    const res = await axios.get(url);

    const video = res.data.items[0];
    if (!video) return;

    const videoId = video.id.videoId;
    const title = video.snippet.title;
    const thumbnail = video.snippet.thumbnails.high.url;

    if (videoId !== lastYoutubeVideo) {
      lastYoutubeVideo = videoId;
      sendYouTube(title, `https://www.youtube.com/watch?v=${videoId}`, thumbnail);
    }
  } catch (err) {
    console.log("YouTube Error:", err.message);
  }
}

// ===================================================================
//                    📌 CHECK TIKTOK
// ===================================================================
async function checkTikTok() {
  try {
    const api = `https://www.tikwm.com/api/user/posts/?unique_id=${tiktokUsername}&count=1`;
    const res = await axios.get(api);

    const data = res.data.data.videos[0];
    if (!data) return;

    const videoId = data.id;
    const title = data.title || "TikTok Video";
    const cover = data.cover;

    // رابط تيك توك الرسمي
    const tiktokUrl = `https://www.tiktok.com/@${tiktokUsername}/video/${videoId}`;

    if (videoId !== lastTikTokVideo) {
      lastTikTokVideo = videoId;
      sendTikTok(title, tiktokUrl, cover);
    }
  } catch (err) {
    console.log("TikTok Error:", err.message);
  }
}

// ===================================================================
//                    ⏳ START CHECKING
// ===================================================================
client.on("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  setInterval(() => {
    checkYouTube();
    checkTikTok();
  }, checkInterval * 1000);

  console.log(`⏱️ Checking every ${checkInterval} seconds...`);
});

// ===================================================================
client.login(token);
