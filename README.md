# 🎵 SoundPeel

スマホの**動画から音声（MP3 / WAV）を抜き出して保存**できる、インストール不要のWebアプリ（PWA）です。

- 📱 **iPhone / Android 両対応**（ブラウザで開くだけ）
- 🔒 **完全ローカル処理** — 動画は外部に送信されません（ffmpeg.wasm でブラウザ内変換）
- 📶 **オフラインOK** — 一度開けばネットなしでも使えます
- 💸 **無料・広告なし・アカウント不要**

---

## 使い方

1. アプリのURLをスマホのブラウザで開く
2. **「動画を選ぶ」** → 端末内の動画を選択
3. **形式（MP3 / WAV）** を選ぶ（MP3は音質も選べます）
4. **「音声を抜き出す」** をタップ
5. **「保存 / 共有」** で「ファイル」アプリや各種アプリへ保存

> 初回だけ変換エンジン（約32MB）を読み込みます。2回目以降はキャッシュされます。
> ホーム画面に追加すると、普通のアプリのように使えます。

---

## GitHub Pages で公開する手順

このリポジトリはそのまま静的サイトとして動きます。

### 方法A: ブランチから公開（かんたん）
1. このフォルダを GitHub リポジトリとして push
2. リポジトリの **Settings → Pages**
3. **Source** を `Deploy from a branch`、Branch を `main` / `(root)` に設定 → Save
4. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開

### 方法B: GitHub Actions（同梱の `.github/workflows/deploy.yml`）
1. Settings → Pages → **Source** を `GitHub Actions` に変更
2. `main` に push すると自動でデプロイされます

> どちらでも動きます。特別なサーバー設定（COOP/COEP等）は不要です
> — シングルスレッド版 ffmpeg.wasm を使っているため `SharedArrayBuffer` を必要としません。

---

## 対応フォーマット

- **入力**: mp4 / mov / mkv / webm / avi / m4a / mp3 など、動画・音声全般
- **出力**: `MP3`（128/192/256/320 kbps）/ `WAV`（16bit PCM・無圧縮）

---

## 技術メモ

- 変換エンジン: [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)（`@ffmpeg/core` シングルスレッド版）を `vendor/ffmpeg/` に同梱
- ビルド工程なし。素の HTML / CSS / JS のみ
- PWA: `manifest.webmanifest` + `sw.js`（アプリ本体とエンジンをキャッシュしオフライン動作）
- 保存: Web Share API（対応端末）→ 非対応時はダウンロードにフォールバック

### 既知の制限
- 変換はファイル全体をメモリに載せるため、**とても長い / 大きい動画**はスマホのメモリ上限で失敗することがあります（短く切ると回避できます）。
- MP3 エンコードは `libmp3lame` を使用。万一失敗する環境では **WAV** をお試しください。

---

## ローカルで動かす（開発時）

`file://` では Service Worker やモジュールが制限されるため、簡易サーバーで開きます。

```bash
# 例（Python）
python -m http.server 8000
# → http://localhost:8000 を開く
```

## ライセンス
MIT（同梱の ffmpeg.wasm は MIT / LGPL・GPL）。`LICENSE` を参照。
