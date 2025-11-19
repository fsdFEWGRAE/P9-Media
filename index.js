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

// ---------------- CONFIG ----------------
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const {
  token,
  mediaChannel,
  youtubeChannelId,
  youtubeApiKey,
  tiktokUsername,
  checkInterval
} = config;

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
//                    📌 SEND MESSAGE WITH BUTTON
// ===================================================================
async function sendMedia(platform, title, link, thumbnail) {
  const channel = client.channels.cache.get(mediaChannel);
  if (!channel) return console.log("❌ Media channel not found!");

  // زر مشاهدة الآن
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("مشاهدة الآن")
      .setStyle(ButtonStyle.Link)
      .setURL(link)
  );

  await channel.send({
    content: "@everyone",
    embeds: [
      {
        title: `📢 جديد ${platform}: ${title}`,
        url: link,
        description: "🎬 **تم نشر فيديو جديد للتو!**",
        color: 0xff0000, // الخط الأحمر
        image: { url: thumbnail },
        footer: { text: `${platform} Auto Media Bot` }
      }
    ],
    components: [row]
  });

  console.log(`📢 Sent new ${platform} video: ${title}`);
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
      sendMedia("YouTube", title, `https://www.youtube.com/watch?v=${videoId}`, thumbnail);
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
    const url = data.play;
    const cover = data.cover;

    if (videoId !== lastTikTokVideo) {
      lastTikTokVideo = videoId;
      sendMedia("TikTok", title, url, cover);
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

client.login(token);
