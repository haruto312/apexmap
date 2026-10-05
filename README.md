# APEX / TRACKER

Apex風の個人用ダッシュボード。既存のランクマップ (`index.html`) とミックステープ (`mixtape.html`) はそのまま、`tracker.html` にマイトラッカーを追加しています。ビルド不要の静的HTML / CSS / JavaScriptで、GitHub Pagesでも動作します。

## 使い方

1. GitHub PagesのURLに `/tracker.html` を付けて開く（このリポジトリなら通常 `https://haruto312.github.io/apexmap/tracker.html`）。既存ページの「マイトラッカー」からも移動できます。
2. 「接続設定」を開き、PCを選択。Steamの表示名ではなく、連携している **EA / Origin ID** を入力します。UIDを知っていればUIDでも接続できます。
3. [apexlegendsapi.com](https://apexlegendsapi.com/) で取得したAPIキーを入力して接続します。
4. ページを再読み込みするとキーは消えるため、もう一度接続してください。プレイヤー情報と取得記録のみ端末に保存されます。別のPCやブラウザーとは同期しません。

デモモードは架空の数値を明示し、初期表示と接続解除後のプレビューに使用します。実アカウントの戦績ではありません。

## 表示できるデータ

- プレイヤー名、UID、レベル、オンライン状態、バトルロイヤルの現在ランク・RP。
- APIが返した合計キル／ダメージ、レジェンドごとの取得可能なトラッカー。未取得・負の番兵値は `—`。シーズン勝利数を通算勝利数に合算したり、キル数からK/Dを推測したりしません。
- APIのマップローテーション v2。戦績が取得できてもマップ取得が失敗した場合、戦績を残してマップの状態を明記します。
- この端末で取得したRPの推移。最大5,000件を保存し、直近30件をグラフに表示します。記録をJSONで書き出せます。
- 手動更新は1分間隔。任意の自動更新は4分間隔で、タブが非表示の間は停止します。

[APIドキュメント](https://apexlegendsapi.com/) に従い `/bridge?version=5` と `/maprotation?version=2` を使用。公開APIの制限により、全ての通算値が揃うとは限りません。対戦履歴APIは新規ユーザーの利用が制限されているため、対戦結果・勝率を捏造せず、RPの取得記録を表示します。

## APIキーの扱い

APIキーはGitHub、localStorage、sessionStorage、書き出しファイルに保存しません。ブラウザーのメモリでのみ保持し、接続解除で削除します。入力欄も接続後や設定を閉じたときに消去します。

直接接続では、APIのCORS設定がAuthorizationヘッダーを許可していないため、ドキュメントの `auth` クエリパラメーターを使用します。送信先は `https://api.apexlegendsstatus.com` に固定し、リファラーを送信しません。キーは開発者ツールのリクエストに見え、API提供元のアクセスログにも記録され得ます。公開ソースにキーを埋め込まないでください。

APIキーをブラウザーにも渡したくない場合は、付属の専用プロキシを使用してください。サイト自体は静的ページなので、URLを知っている人はデモ画面にアクセスできます。実データの取得にはキーまたは専用アクセストークンが必要です。

## 任意：Cloudflare Workerの専用プロキシ

`proxy/worker.js` は、APIキーをサーバー側で保持し、設定したプレイヤーUIDだけを取得します。第三者が自由にAPIを呼ぶためのプロキシにはなりません。

1. CloudflareアカウントとWrangler CLIを用意します（[Wrangler公式ドキュメント](https://developers.cloudflare.com/workers/wrangler/)）。
2. `proxy/wrangler.toml` の `PLAYER_UID` に自分の数値UIDを設定。`PLAYER_PLATFORM` は `PC`。`ALLOWED_ORIGIN` はサイトのオリジン（パス `/apexmap` を含めない）です。
3. `proxy` ディレクトリで `npx wrangler secret put APEX_API_KEY` を実行し、プロンプトでAPIキーを入力。
4. `npx wrangler secret put ACCESS_TOKEN` で十分に長いランダムな自分専用のトークンを設定。キーやトークンはコード・TOMLに書かないでください。
5. `npx wrangler deploy` で公開します。
6. サイトの接続設定で「専用プロキシを使用」を選択。WorkerのHTTPS URLとアクセストークンを入力します。取得対象はWorker側に固定したUIDです。画面のプレイヤー名指定はプロキシの取得対象を変更しません。

Workerはオリジン確認に加えてトークン認証を行い、60秒のメモリキャッシュと同時リクエストの統合を実装。ブラウザーへの応答は `Cache-Control: no-store`。トークンもブラウザーには保存されません。この追加デプロイは任意で、直接接続では不要です。

## ローカル確認

Node.js 22以降。追加パッケージなしで実行できます。

```sh
npm start
# http://127.0.0.1:5173/tracker.html
npm test
npm run check
```

PagesにはHTML、`tracker/` を含む静的ファイルを配置してください。`file://` から開くとモジュール／JSONの取得ができないため、HTTPサーバーを使います。APIキー未設定での実装検証はモック応答を使用しており、実キーでの成功・API提供元の現在の状態を保証するものではありません。

## 画像と帰属

公式レジェンド画像は [EAキャラクターハブ](https://www.ea.com/ja/games/apex-legends/apex-legends/characters-hub) から配信される画像を使用。8名の公式画像URLと取得元は `tracker/assets.json` に記録しています。それ以外はAPIの `ImgAssets` を利用し、取得できない画像は非表示にしてテキスト表示を残します。ランクバッジもAPIの `rankImg` を利用し、未取得時は図形を表示します。マップのフォールバック画像は既存ページで使用しているEA配信画像です。

Apex Legends、キャラクター、画像の権利はElectronic Arts / Respawn Entertainmentに帰属します。非公式の個人プロジェクトです。外部画像のURLが変更された場合は差し替えてください。API提供元への帰属リンクを画面に表示しています。
