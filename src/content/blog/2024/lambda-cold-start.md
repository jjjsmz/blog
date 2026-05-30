---
title: AWS Lambda で環境変数が変更されたときも，コールドスタートになります
pubDate: 2024-04-06
updatedDate: 2026-05-30
description: AWS Lambda で環境変数が変わったとき，コールドスタートになるのか試してみました．
tags: ['python', 'aws', 'tips']
---

AWS Lambda において，ハンドラ外のコードはコールドスタートの時のみ実行されるという話はよくされています[^1]．
また，新しくデプロイすると，古い実行環境は廃止され，新しい実行環境が作成されることもよく知られています．

しかし，環境変数のみ変更したとき，コールドスタートになるのか気になったので，先行記事がないか調査してみましたが，見つからなかったため，自分で試してみました！

[^1]: [Developers.ioの記事](https://dev.classmethod.jp/articles/lambda-outside-handler-running-first/)

## 実行環境

実際に使用したコード，インフラ構成は [こちら](https://github.com/jjjsmz/playground/tree/aa89c993e46e718cf646ce5e38380bfc27d3bc52/aws/lambda-cold-start)．

Lambda 関数は以下の実装になっています．
ハンドラ外で，現在時刻，環境変数を取得し，ハンドラ内でも現在時刻を取得しています．
そして，それらをレスポンスとして返しています．

https://github.com/jjjsmz/playground/blob/aa89c993e46e718cf646ce5e38380bfc27d3bc52/aws/lambda-cold-start/src/main.py#L1-L24

## 実験

1. 前節で示したコードをデプロイし
2. デプロイした関数の関数 URL に対し，500ms ごとにリクエストを送信をし続ける
3. 環境変数を手動で変更
   1. ハンドラ外で定義した値に変化がみられるか確認

## 結果

なんと，環境変数を変更した直後に，ハンドラ外で定義した変数，読み込んだ環境変数の値が変わっていました！
環境変数を変更した直後は，コールドスタートになるため，init が入り，少しレスポンスが遅くなっていることを確認できます．

また，X-Ray でトレースを取得したところ，コールドスタートが発生していることも確認できました．

以下，500ms ごとにリクエストを送信したときのログです．

```
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:27.309945', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:27.848920', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:28.397632', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:28.945975', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:29.491589', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:03.285905', 'time_in_handler': '2024-04-06 16:24:30.034864', 'env_user': 'user'}
{'time_out_of_handler': '2024-04-06 16:24:30.759348', 'time_in_handler': '2024-04-06 16:24:30.762272', 'env_user': 'user2'}
{'time_out_of_handler': '2024-04-06 16:24:30.759348', 'time_in_handler': '2024-04-06 16:24:31.306591', 'env_user': 'user2'}
{'time_out_of_handler': '2024-04-06 16:24:30.759348', 'time_in_handler': '2024-04-06 16:24:31.843653', 'env_user': 'user2'}
{'time_out_of_handler': '2024-04-06 16:24:30.759348', 'time_in_handler': '2024-04-06 16:24:32.390752', 'env_user': 'user2'}
```
