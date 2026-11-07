---
title: Astro@2でブログを開設
pubDate: 2023-01-31
description: astroでブログを一から作ってみた
tags: ['astro', 'frontend']
---

修論が終わってようやくリラックスできる時間ができたが，同時に学生の終わり，すなわち社会人の始まりを実感します．
わくわくどきどきです．

今後はまとまった時間を取るのが大変そうなので今のうちに自由に学びたいことをやってみようと思う．ひとまず，面白そうなフレームワークを使って，ブログを作ってみました．

私は，いろんな技術記事を読むのが趣味で日ごろからインプットには欠かさないようにしていますが，修論のせいで，特に年末あたりから忙しくなり，技術を追得なくなっていました．
ようやく時間に余裕ができたので，たまっていた記事を読んでいると，[Publickey の記事](https://www.publickey1.jp/blog/23/astro_20content_cllectionsmarkdownhybrid_rendering.html) が目に留まりました．
なんと，Astro という静的サイトジェネレータが注目されているらしい．MD でかけるのはうれしい．

最近は，Vue や React といった SPA のフレームワークばっかり注目されているようですが，私は MPA の時代はまだまだ続くし，期待もしています．

軽く Astro を触ってみたところをおもしろそうだったので，IT に関する学んだ技術・スキル・直面した課題とその解決法などをブログとして残していこうと思います．

## 使用技術

本ブログの主な使用技術．

- #### `"astro": "2.0.6",`
  - このブログを構成するメインの MPA フレームワーク
  - 記事を md, MDX で書けるのが便利
  - [ドキュメント](https://docs.astro.build/ja/getting-started/) も結構整ってる
- #### `"@astrojs/image": "0.14.0"`
  - 画像をいい感じに最適化してくれる
  - `public/img/` に解像度とか考えずに放り込んどいて，ビルド時に webp に変換するようにする
  - 解像度も指定するといい感じになる
- #### `"tailwindcss": "3.2.4"`
  - CSS フレームワークは tailwind を使うことにした
  - ここは特にこだわりはないが，`@astrojs/tailwind` があったのが大きな決め手
- #### Firebase Hosting
  - ホスティングサービス
  - 別プロジェクトでも使っていてある程度慣れているため
- #### Google Domains
  - Firebase でホスティングするんで，Google アカウントにまとめると楽そうだから
  - また，お名前ドットコムはメールがうっとうしいため信頼できる Google を選んだ

## ディレクトリ構成

ディレクトリ構成はかなりシンプル．

`astro.config.mjs` に Astro の設定を書いて（設定を書くと言っても数行書くだけ），他のコードは `src/` の中．
`src/components/` は React のような文法でコンポーネントを書く．
マークダウンで書いた記事は `src/content/` に置く．
Next.js や Nuxt のようにファイル名で動的ルーティングが可能で，`src/pages/` 下に置いたファイルのパスアクセスできる．
ここで `[...page].astro` は記事一覧となり，`[slug].astro` は各 md, MDX の記事となる．

各ページのレイアウトは `src/layouts/` に書いておいて，`page/` 下の Astro ファイルで読み込むと便利．

```
.
├── astro.config.mjs
├── dist/
├── firebase.json
├── node_modules/
├── package.json
├── public/
│   ├── favicon.svg
│   └── img/
├── src/
│   ├── components/
│   │   ├── *.astro
│   ├── const.ts
│   ├── content/
│   │   ├── config.ts
│   │   ├── game/
│   │   │   ├── *.mdx
│   │   └── tech/
│   │       └── *.mdx
│   ├── env.d.ts
│   ├── layouts/
│   │   └── MainLayout.astro
│   ├── pages/
│   │   ├── game/
│   │   │   ├── [...page].astro
│   │   │   └── [slug].astro
│   │   ├── index.astro
│   │   └── tech/
│   │       ├── [...page].astro
│   │       └── [slug].astro
│   └── util/
│       └── utils.ts
├── tailwind.config.cjs
└── tsconfig.json
```

### 一通り書き終えた所感

だいたい 3 日くらいでいい感じになりました．まだ，astro@2.0 が出て日が浅いですが，癖はあまりないため，簡単に書けました．特に jsx の記法に慣れている人はすぐできそうです．
Astro は MPA なので SEO 関連も簡単そうですし，広告を置くことも難しくなさそうです (広告を置くつもりはあまりないですが)．

あと，md, MDX で書いた記事のエクスポート/インポートが可能なため，他サービスへの移行も容易だと思われます．
