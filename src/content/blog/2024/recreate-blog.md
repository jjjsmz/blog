---
title: Astro@4でブログを再構築
pubDate: 2024-01-14
updatedDate: 2026-04-19
description: 放置していたブログをAstro@4で作り直しました
tags: ['astro', 'frontend']
---

一年ほど前，[Astro@2 で環境構築](/blog/2023/first-article/) まではやったけれども，メンテしておらず，余裕がなかったため，放置していたブログを再構築してみた．
久しぶりにフロントエンドを書いたが，かなりなまってて全然かけなかったです．CSS ってこんなに難しかったっけ？

## 使用技術

- Astro 4.1.2
  1 年前は 2.0.6 だったのに，もう 4.1.2 になっていた．
  更新がすごく早いですね．
- Cloudflare Pages
  最近は Cloudflare をよくつかっています．
  Google Domains が終了してからドメインを Cloudflare に移管したり，個人の Web アプリを Cloudflared を使って公開したりと，ちょっとずつ使用率を増やしています．
  IaC で管理するために，Terraform で管理したいとも思っています．[cf-terraforming](https://github.com/cloudflare/cf-terraforming) を使うと楽そう．

- [Octicons](https://primer.style/foundations/icons/)
  シンプルで使いやすい．GitHub によって提供されている．

## 以前から改善した点

### tailwindcss は剥がした

便利だけれども，宣言されているクラスが多すぎました．
本ブログには，そんなに複雑なデザインでないし，最低限のものだけでこと足ります．
ビルド後のファイルサイズを小さくするためにも，やっぱりいらないだろうと判断しました．
フロントをあまり書かなくなった SRE が，1 年前に作ったものを見返してもあまりデザインの構成が理解できなかったのも大きいですね．
HTML 上のタグが長く長すぎるのも避けたいです．
常日頃から tailwind を使っていないと，クラス名だけを見ても，どのような CSS が適応されているかわからないという欠点もありました．実際，私はわかりませんでした．

また，CSS は CSS ごとにまとまっているほうがメンテナンス性は高いと思ってます．
自分でクラスを作成し，最低限のものコンポーネントごとに記述することで，メンテナンス性を高めました．

### デプロイ先

以前は，Firebase Hosting を使っていましたが，Cloudflare Pages に移行してみました．上にも書きましたが，以前はほかに Firebase で公開しているサービスがあったのと，Google Domains でドメインを取っていたため，Firebase を使っていました．
けれども，Google Domains の終了に伴い，レジストラを Cloudflare に移行しました．さらに，当時 Firebase で公開してたサービスに，Cloudflared を使用するようになりました．

たくさんのサービスを使うと，一人で管理できなくなっちゃうので，本ブログも Cloudflare Pages に移行しました．

### コードブロックにコピーボタンを追加

コードブロックには，ファイル名やコピーボタンがないと，技術ブログとしては非常に残念な形になってしまいます．(手軽にコピーして試せないと，おもてなしできていない)

実現するために，先駆者や既存ライブラリを探しましたが，ファイル名の表示とコピーボタンを一緒に実装しているものが見つからなかったです．
コピーボタンの実装をいくつか読んでみましたが，クライアント側の js でコピーボタンを作ってるものが多かったです．

私はビルド時にボタンの生成までやりたかったので，remark で実現しました．
`src/plugins/remarkAddCodeUtil.js` にファイル名の追加と，コピーボタンの追加をしています．
これを `astro.config.mjs` で `remarkPlugins` に食わせることで，ビルド時にボタンの追加を実現できました．

クライアント側であまりスクリプトを使わないようにしたかったけれでも，コピーするアクションはクライアント側でしかできないので，コピーの実現は `src/layouts/BlogPost.astro` に記述しています．

また，ボタンやファイル名のスタイルは，`/src/styles/global.css` に記述しています．
https://github.com/jjjsmz/blog/blob/4101e558e31471928781d55b708da8e88b2d468a/src/plugins/remarkAddCodeUtil.js#L1-L45

https://github.com/jjjsmz/blog/blob/4101e558e31471928781d55b708da8e88b2d468a/src/layouts/BlogPost.astro#L128-L154

### og画像の生成

`/src/pages/og/[...slug].webp.ts` に，`/src/pages/blog/[...slug].astro` の OGP 画像を生成するエンドポイントを作りました．実装としては，`satori-html` に HTML を渡して，svg を生成し，`sharp` で webp に変換しています．

Astro でブログを作って公開している人たちにとても感謝しています．ありがとうございます！
先人たちは，ビルド時に Google Fonts からフォントの URL を取得して，そのファイルをぶっこ抜いて，むりやり生成している例が多かったですが，私は，フォントはローカルに用意して置いたものを使ってます．

https://github.com/jjjsmz/blog/blob/4101e558e31471928781d55b708da8e88b2d468a/src/pages/og/%5B...slug%5D.webp.ts#L1-L23

https://github.com/jjjsmz/blog/blob/4101e558e31471928781d55b708da8e88b2d468a/src/utils/og.ts#L1-L86

## フォルダ構成

```
.
├── astro.config.mjs
├── dist/
├── node_modules/
├── package-lock.json
├── package.json
├── public
│   ├── favicon.ico
│   ├── img
│   │   ├── me.webp
│   │   └── me_thumbnail.webp
│   └── robots.txt
├── src
│   ├── components
│   │   ├── BaseHead.astro
│   │   ├── BlogCard.astro
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   ├── HeaderLink.astro
│   │   ├── Pages.astro
│   │   ├── TagList.astro
│   │   └── Toc.astro
│   ├── consts.ts
│   ├── content
│   │   ├── blog
│   │   │   ├── 2022
│   │   │   │   ├── *.md
│   │   │   ├── 2023
│   │   │   │   ├── assets
│   │   │   │   │   ├── *.webp
│   │   │   │   ├── *.md
│   │   │   ├── 2024
│   │   │   │   └── *.md
│   │   │   └── draft
│   │   └── config.ts
│   ├── env.d.ts
│   ├── fonts
│   │   └── noto-sans-jp-v52-japanese_latin-regular.woff
│   ├── layouts
│   │   ├── BlogList.astro
│   │   ├── BlogPost.astro
│   │   └── General.astro
│   ├── pages
│   │   ├── 404.astro
│   │   ├── [...page].astro
│   │   ├── about.astro
│   │   ├── blog
│   │   │   └── [...slug].astro
│   │   ├── og
│   │   │   └── [...slug].webp.ts
│   │   ├── rss.xml.js
│   │   └── tags
│   │       └── [tag]
│   │           └── [...page].astro
│   ├── styles
│   │   └── global.css
│   └── utils
│       ├── og.ts
│       └── util.ts
└── tsconfig.json
```

## 参考になったリポジトリ様

- https://github.com/macoshita/macoshita.me-astro
- https://github.com/h-yoshikawa44/change-of-pace-astro
- https://github.com/retrorocket/astro-blog
- https://github.com/hiroppy/site
