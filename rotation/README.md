# Season 31 map rotation / API connection

ランクとミックステープの現在・次のマップは、[Apex Legends API](https://apexlegendsapi.com/documentation) の `maprotation?version=2` から取得します。APIキーはGitHub Actionsの非公開Secretだけに保存します。個人用トラッカーのキー入力・専用プロキシは変更していません。

## 最初の設定

1. [API Portal](https://portal.apexlegendsapi.com/) で、このプロジェクト用のAPIキーを取得します。既にこのプロジェクトのキーを持っている場合は同じキーを使用します。
2. [リポジトリのActions Secrets](https://github.com/haruto312/apexmap/settings/secrets/actions) を開き、New repository secretから **Name: `APEX_API_KEY`**、Secret: 発行済みAPIキーを保存します。キーはコード、コミット、Issue、チャットへ貼り付ける必要はありません。
3. この変更をmainへ反映した後、[Actions](https://github.com/haruto312/apexmap/actions) → **Update map rotation** → **Run workflow** を実行します。
4. 実行が成功し、`data/rotation.json` に `ranked` / `mixtape` のデータが入っていることを確認します。APIの状態や契約で一方だけ取得できる場合は、そのモードだけ表示します。
5. [ランクページ](https://haruto312.github.io/apexmap/) と [ミックステープページ](https://haruto312.github.io/apexmap/mixtape.html) を開き、API取得時刻と現在・次のマップを確認します。

以降、Actionsは5分間隔で更新します。GitHubの定期実行には遅延があり、厳密な5分ごとの実行は保証されません。公開リポジトリで長期間操作がない場合、GitHubによりスケジュールが無効になることがあります。

## 表示とデータ

- APIのUNIX時刻を変換し、日本時間で表示します。画面の時刻文字列からの推測や前シーズンの基準時刻は使いません。
- APIが返した現在・次の枠を優先します。ランクの7日分、ミックステープの3時間分のうち、その先はシーズン31の循環からの**予測**と表示します。
- APIに現在の枠がない場合は「取得待ち」を表示します。古いスナップショットで未来の現在マップを断定しません。7日後に機能を停止する処理はありません。
- APIの返した組み合わせが登録済みの循環と異なる場合、その循環での予測は行いません。
- ブラウザは1分間隔で、公開済みの `data/rotation.json` をraw.githubusercontent.comから読みます。ActionsのコミットごとにPagesが再デプロイされるのを待つ必要はありません。フォークした場合はHTML内の取得URLを自分のリポジトリに変更してください。
- JSONには選択したマップ、モード、開始・終了時刻、画像だけを保存します。API応答全体やAPIキーは保存・公開しません。
- APIキー未登録の初期JSONは設定待ちの状態です。実APIの接続成功はキー登録後に確認が必要です。

## 新シーズンの対象マップ

[EA公式「サイファー」パッチノート](https://www.ea.com/ja/games/apex-legends/apex-legends/news/cipher-patch-notes) に基づき、ランクはストームポイント、E地区（夜）、ブロークンムーン。ミックステープはサンダードーム、フラグメント、スカルタウン、生産工場、バロメーター、ワットソンのパイロン、モニュメントに対応しています。循環の順序は[Apex Legends Statusの公開予定](https://apexlegendsstatus.com/current-map/mixtape/pubs)を参照しています。

画像はAPIのassetを優先し、取得できない場合は各マップの既存画像を使用します。画像・ゲームの権利はEA / Respawnに帰属します。

## 検証

```sh
node --test tests/rotation.test.mjs
node --check scripts/update-rotation.mjs
```

テストはモックのAPI応答で、秒→ミリ秒、日本語名、切り替え境界、予測の区別、画像URL、キーを含まない公開JSON、両ページの初期表示・取得後表示を検証します。実キーでの接続検証は含みません。
