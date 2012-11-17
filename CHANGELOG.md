# CHANGELOG


## Ver.1.2.0
    + リンクを外部のブラウザで開く機能を実装
    + 移動ボタンのロングプレスでの移動ダイアログ表示機能を実装
    + キャッシュの検証機能を実装
    + 自分からのリブログの非表示機能を実装
    + 戻るボタンの誤操作防止処理を実装
    + リブログ時のコメント追加機能を実装

    + Implement the ability to open links in external browser.
    + Implement the ability to view Jump dialogs by a long press of the move button.
    + CheckImplement validation for cache.
    + Implementation process of hidden reblogged this from you.
    + Implementation process of the back buttons prevent accidental operation.
    + Implement the ability to add a comment when reblogged.

## Ver.1.1.2
    - ポストの移動ダイアログのレイアウトを調整

    - Adjust the layout of the "jump post dialog"

## Ver.1.1.1
    - 起動時のRuntime errorを修正
    - "An application restart is required" メッセージが不必要に出ないように修正

    - Fix runtime error in startup
    - Fix "An application restart is required" message

## Ver.1.1.0
    + ポストの移動機能を実装
    + リブログ時にタグを指定する機能を実装
    - 細かな不具合修正

    + Implemented of post jump
    + Implemented of reblog with tags
    - Minor bug fix


## Ver.1.0.0
    最初のリリースです。

    First release!

# ISSUE

* アプリケーションの許可のためのログイン時にローダーが
  パスワードの保存ダイアログに被る
  →サンプルだと問題ない
  →データのクリアで初期状態に戻るので試せる
* アプリケーションの許可後にローダーが消えない
  →サンプルでも同じ
* リブログ中に応答が帰ってこなくなる
  →リブログ後Pinが残る原因
  →

# TODO

* 設定メニューからのアプリケーションの許可をしたい
  intent経由でやるしかない？
* LIKE機能
* POSTの表示(Chat)
* POSTの表示(Answer)
* 画像のキャッシュ
* リブログ前に確認のダイアログを表示
* (位置のブックマーク機能)
* 設定画面でのタグ指定時orタグ指定前に"文字などのエスケープ処理が必要
* リブログ時のコメント
* キャッシュのクリアとリロード処理
  →リロード時にはどの位置から取得すべきか？API的には順に取得すると260件までしか取得できない
  →バックグラウンドでの読み込みに特化すべきか？
* ポスト内のリンクをロングタップでメニューが出てほしい
  →ブラウザを選ぶメニュー？共有など？
* 表示文字の英語対応/多言語対応
* 手動でのポストの読み込み機能
  →バックグラウンドでの読み込みと設定で切り替え？
* ネットワーク障害などでtumblrにアクセスできない場合は、その旨を表示する
  →現状だと[←]を押しても単に反応がなくなる

