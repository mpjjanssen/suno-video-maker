
import express from 'express';
import multer from 'multer';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import lrcParser from 'lrc-parser';

const app = express();
const upload = multer({ dest: path.join(tmpdir(), 'uploads') });
app.use(express.static('public',{extensions:['html']}));

app.post('/api/generate',upload.fields([{name:'audio',maxCount:1},{name:'lyrics',maxCount:1}]),async(req,res)=>{
  try{
    const audio=req.files.audio[0].path;
    const lrc=req.files.lyrics[0].path;
    const parsed=lrcParser.parse(readFileSync(lrc,'utf-8'));
    const fmt=s=>new Date(Math.floor(s*1000)).toISOString().substr(11,12).replace('.',',');
    let srt='';parsed.forEach((line,i)=>{const start=line.time;const end=i+1<parsed.length?parsed[i+1].time:start+5;srt+=`${i+1}\n${fmt(start)} --> ${fmt(end)}\n${line.text}\n\n`;});
    const srtPath=path.join(tmpdir(),`${Date.now()}.srt`);writeFileSync(srtPath,srt);
    const out=path.join(tmpdir(),`${Date.now()}.mp4`);
    await new Promise((res,rej)=>{execFile(ffmpegPath.path,['-y','-i',audio,'-vf',`subtitles=${srtPath}:force_style='FontName=Arial,FontSize=28'`,'-pix_fmt','yuv420p','-c:v','libx264','-c:a','aac',out],err=>err?rej(err):res());});
    res.download(out,'lyric-video.mp4',async()=>{await unlink(out);await unlink(srtPath);});
  }catch(e){console.error(e);res.status(500).send('Failed');}finally{for(const files of Object.values(req.files)){for(const f of files)await unlink(f.path).catch(()=>{});}}});
app.listen(3000,()=>console.log('API ready'));
