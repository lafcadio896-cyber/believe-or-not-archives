# データモデル

本文の正本は `data/YYYY/MM/YYYY-MM-DD.json` の日別JSONだけとする。以下はすべて、本文とは分離した解析・拡張レイヤーである。

## Fingerprints

保存先: `data/fingerprints/YYYY/MM.json`

古い作品との軽量な比較や、将来のクラスタリング・統計に使う派生データ。日別正本からGitHub Actionsが機械的に再構築するため、手編集しない。

主な項目:

- `subject`: 主題の目安
- `motifs`: 元作品のタグ
- `context`: 地域・年代・記録媒体
- `beats.setup`: 導入
- `beats.anomaly`: 怪異の提示
- `beats.verification`: 確認・展開
- `beats.ending`: 結末
- `signals`: 再帰、帰還、重複、時間ずれ、空間ずれ、痕跡などのkeywordベースの弱い推定
- `ending_signals`: 最終行だけから取った弱い推定
- `metrics`: 行長、文数など
- `digests.content_sha256`: 完全重複検出用
- `digests.shape_sha256`: 題材・媒体・signal構成が一致する候補を探すための補助値

`signals` は正解ラベルではない。作品同士を比較するための手掛かりとしてのみ扱う。

## Assets

索引: `data/assets/index.json`

月別sidecar: `data/assets/YYYY/MM.json`

本文JSONへ画像・音声などの情報を埋め込まず、後から任意の記録に資料を付与する。

```json
{
  "version": 1,
  "month": "2026-08",
  "items": [
    {
      "id": "A-L-20260826-001-01",
      "lore_id": "L-20260826-001",
      "type": "image",
      "status": "available",
      "path": "assets/2026/08/L-20260826-001-01.webp",
      "caption": "玄関付近で撮影されたとされる写真",
      "alt": "暗い玄関と傘立て"
    }
  ]
}
```

### `type`

- `image`
- `audio`
- `map`
- `document`

### `status`

- `planned`: 将来追加する予定
- `available`: 実ファイルまたはURLが存在する
- `withheld`: 設定上は資料があるが公開しない

`available` の場合は `path` または `url` が必須。サイトは `available` の資料だけを自動表示する。

画像では `caption` / `alt`、音声では `caption` / `transcript`、文書では `caption` などの任意フィールドを追加してよい。

## Relations

索引: `data/relations/index.json`

月別sidecar: `data/relations/YYYY/MM.json`

作品同士の関連を「正解」として固定せず、あくまで候補として保持する。月別ファイルは `source` 側作品の公開月に置く。

```json
{
  "version": 1,
  "month": "2026-08",
  "relations": [
    {
      "source": "L-20260826-001",
      "target": "L-20261014-004",
      "kind": "motif",
      "status": "candidate",
      "score": 0.78,
      "basis": ["雨の翌朝", "処分後も戻る物"]
    }
  ]
}
```

### `kind`

- `similarity`: 全体的な類似
- `motif`: モチーフの共通
- `mechanism`: 怪異の仕組みの共通
- `ending`: オチ・残存物の共通
- `geographic`: 地理的な関連候補
- `temporal`: 年代・時刻などの関連候補
- `editorial`: 人手で指定するその他の関連

### `status`

- `candidate`: 仮説・候補
- `reviewed`: 確認済みの関連候補
- `rejected`: 一度候補になったが採用しない

`score` は任意で0〜1。高い値でも「同じ怪異である」という意味にはしない。

## 原則

- 本文正本と解析結果を混ぜない
- AssetsやRelationsが空でも作品データは成立する
- Fingerprintsはいつでも全再生成できる
- AssetsとRelationsは人間または将来の分析処理が追加するsidecarであり、本文再生成で消さない
- 統計・クラスタリング・地図・関連表示などの将来機能は、この3レイヤーを読むだけで追加できるようにする
