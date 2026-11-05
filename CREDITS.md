# Credits · 署名与许可

## 本项目
- 沉浸式音乐厅原型：原创场景、乐团低模、选座交互与代码。
- 玩法灵感来自韩国虚拟寺庙「山寺 / Sansa」（sansatemple.com）的「免登录进入、走动、简单互动」模式；未复制其代码或美术素材。
- **场景气质参照**：韩国富川艺术中心音乐厅（부천아트센터 콘서트홀，2023年5月开馆），亦为韩剧《四手联弹 / 포핸즈》第11集「韩国交响80周年」音乐会取景地。本项目仅根据公开文字资料与布局说明做**原创低模概括**，未使用任何版权照片作为贴图，亦非官方数字孪生。

## 建筑参照来源（仅作设计笔记，非贴图）
- 官网座位与设施说明：https://www.bac.or.kr （Concert Hall / 콘서트홀）
- 座位区划与 CAD 解读摘要：https://seatsoundview.com/en/venues/bucheon-arts-center-concert-hall/
- 新闻与导览（管风琴、反射板、木饰面描述）：韩联社 [AKR20250227039200065](https://www.yna.co.kr/view/AKR20250227039200065)、舞台音响协会测量文、L-Acoustics 新闻稿
- 公开要点：约 1,445 座；鞋盒 + 葡萄园混合；舞台后方加拿大 Casavant Frères 管风琴（4,576 管）；合唱席 P 区在琴前；天花可升降声学反射板；桦木/暖色木饰面；1F/2F/3F 分层

## 音频（占位，可替换）
- 占位音已移除，见下方 Music。
- 替换时覆盖该文件或改 `js/main.js` 中 `audio.load(...)`，并在此记录来源与许可

## 依赖
- Three.js r170（本地 `vendor/three/three.module.js`）

## Music (all from Wikimedia Commons, Musopen recordings; trimmed to first 5 min, re-encoded 96k MP3)
- Rachmaninoff — Piano Concerto No. 2, Op. 18, I. Moderato — Musopen — Public domain — https://commons.wikimedia.org/wiki/File:Sergei_Rachmaninoff_-_piano_concerto_no._2_in_c_minor,_op._18_-_i._moderato.ogg
- Tchaikovsky — Piano Concerto No. 1, Op. 23, I. Allegro — Musopen — CC0 — https://commons.wikimedia.org/wiki/File:Tchaikovsky,_Concerto_No.1_in_B-flat_minor_Op.23,_I._Allegro.ogg
- Beethoven — Symphony No. 5, Op. 67, I. Allegro con brio — Musopen — Public domain — https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_symphony_no._5_in_c_minor,_op._67_-_i._allegro_con_brio.ogg
- Dvořák — Symphony No. 9 "From the New World", Op. 95, IV. Allegro con fuoco — Musopen — Public domain — https://commons.wikimedia.org/wiki/File:Antonin_Dvorak_-_symphony_no._9_in_e_minor_'from_the_new_world',_op._95_-_iv._allegro_con_fuoco.ogg
- Chopin — Nocturne Op. 9 No. 2 — Frank Lévy (piano) — Public domain — https://commons.wikimedia.org/wiki/File:Chopin_-_Nocturne_No._2_in_E-flat_major,_Op._9_No._2_(Frank_Levy).flac
- Debussy — Clair de lune (Suite bergamasque) — Public domain — https://commons.wikimedia.org/wiki/File:Clair_de_lune_(Claude_Debussy)_Suite_bergamasque.ogg
- Chopin — Étude Op. 10 No. 12 "Revolutionary" — Edward Neeman (piano) — Public domain — https://commons.wikimedia.org/wiki/File:Chopin_-_12_Études,_Op._10_-_No._12_in_C_minor_'Revolutionary'_(Edward_Neeman).flac
- Liszt — La Campanella — Greiss (piano) — Public domain — https://commons.wikimedia.org/wiki/File:Liszt-La_Campanella-Greiss.ogg
(Piano pieces are full-length, re-encoded 96k MP3.)
