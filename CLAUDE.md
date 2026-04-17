# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server on http://localhost:3000
npm run build    # production build + TypeScript type check
npm run lint     # ESLint check
```

## Architecture

This is a **Next.js 16 App Router** project (see `AGENTS.md` — this version has breaking changes). Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4.

### Puyo Puyo game

The app is a single-page ぷよぷよ game:

- **`src/lib/puyoLogic.ts`** — Pure game logic (no React). All board manipulation, movement, rotation, gravity, chain detection, and scoring live here. Import from this file for any game-logic changes.
- **`src/components/PuyoGame.tsx`** — Client component (`'use client'`). Owns all game state via `useReducer`. Three `useEffect`s drive the system: (1) the drop-tick interval, (2) the clear-animation timer keyed on `clearKey`, (3) keyboard event listeners.
- **`src/app/page.tsx`** — Thin server component that renders `<PuyoGame />`.

### Game state machine

```
'idle' ──START──► 'playing' ──(piece lands, chains found)──► 'clearing'
                      ▲                                            │
                      └──────────(AFTER_CLEAR, no more chains)────┘
                  'gameover' ◄──(can't spawn next piece)
```

During `'clearing'`, `clearingCells` holds the cells being animated out. `pendingBoard` is the board state after gravity is applied, ready for the next chain check. `clearKey` increments on each new clearing step so the `useEffect` timer re-runs even though `phase` stays `'clearing'`.

### Scoring

Follows official Puyo Puyo formula: `puyosCleared × 10 × max(1, chainPower + colorBonus + groupBonus)`. Constants are in `puyoLogic.ts`.

### Styling

Tailwind CSS v4 via PostCSS. Global CSS at `src/app/globals.css` — contains the two keyframe animations (`puyo-clearing`, `chain-popup`). Puyo circles are rendered with inline `radial-gradient` styles in `PuyoGame.tsx`; the board grid uses CSS Grid.

---

## ぷよぷよ 要件定義

### 1. ゲーム概要

ブラウザで動作するシングルプレイのぷよぷよゲーム。公式ルール（ぷよぷよ通準拠）に基づき、4つ以上つながった同色のぷよを消して得点を競う。

### 2. ボード仕様

| 項目 | 値 |
|------|----|
| 列数 | 6 |
| 表示行数 | 12 |
| 隠し行数 | 1（スポーン用、row 0） |
| 合計内部行数 | 13 |

### 3. ぷよの種類

- **通常ぷよ**（4色）: 赤・緑・青・黄
- 各色は等確率でランダム生成
- おじゃまぷよは現在未実装（将来対応候補）

### 4. 操作ピース（ツモ）仕様

- 2個1組（ピボット＋サテライト）で落下
- スポーン位置: ピボット = row 1・col 2、サテライト = row 0・col 2（rotation 0）
- 回転方向: 時計回り（rotation +1）／反時計回り（rotation -1）
- 壁蹴り: 回転不可時は `[0,±1]` `[±1,0]` の順でキックを試みる

### 5. 操作キー

| キー | 動作 |
|------|------|
| ← | 左移動 |
| → | 右移動 |
| ↑ / X | 時計回り回転 |
| Z | 反時計回り回転 |
| ↓ | ソフトドロップ（80 ms/段） |
| Space | ハードドロップ（即時着地） |
| Space / Enter | ゲーム開始・リスタート |

### 6. 落下速度（レベル）

- レベルは10個落とすごとに1上昇
- 落下間隔: `max(100, 900 − (level − 1) × 70)` ms
- Level 1: 900 ms、Level 2: 830 ms … Level 12以降: 100 ms（上限）

### 7. 着地・消去・連鎖ルール

1. ピースが下に移動できなくなったら着地
2. 着地後、同色4個以上の連結グループを検出
3. 消去対象があれば **clearing** フェーズへ（380 ms のポップアニメーション）
4. アニメーション終了後にセルを削除し重力を適用、再度グループ検索
5. 消去対象がなくなるまで繰り返す（連鎖）
6. 連鎖終了後に次のピースをスポーン

### 8. スコア計算（公式ぷよぷよ通方式）

```
得点 = 消したぷよ数 × 10 × max(1, 連鎖ボーナス + 色ボーナス + 個数ボーナス)
```

| ボーナス種別 | 内容 |
|-------------|------|
| 連鎖ボーナス | 1連鎖=0, 2=8, 3=16, 4=32, 5=64, 6=96 … （`CHAIN_POWERS` 配列） |
| 色ボーナス | 同時消去の色数に応じて 0/0/3/6/12/24 |
| 個数ボーナス | グループ5個=2, 6個=3, 7個=4, 8個=5, 9個+=6 |

### 9. ゲームオーバー条件

次のピースをスポーンする際に `isValidPosition` が `false` を返す場合（スポーン位置が埋まっている）。

### 10. 表示要素

| 要素 | 内容 |
|------|------|
| ボード | 6×12 グリッド、CSS Grid で描画 |
| ぷよ | 円形 + 放射グラデーション + グロウ + 目のアイコン |
| ゴーストピース | 落下先の半透明アウトライン |
| NEXTピース | 次の2個を縦並びで表示 |
| スコア | タブ数値フォント、リアルタイム更新 |
| レベル | 現在レベルを表示 |
| 連鎖数 | 直近の連鎖数（最大連鎖も保持・表示） |
| 連鎖ポップアップ | 2連鎖以上でアニメーション付き中央表示 |
| スタート画面 | ボード上にオーバーレイ |
| ゲームオーバー画面 | スコア・最大連鎖・リスタートボタンをオーバーレイ |

### 11. 未実装／将来対応候補

- おじゃまぷよ（相殺・送り込み）
- 対戦モード（CPU / 2P）
- ハイスコアの永続化（localStorage）
- モバイル向けタッチ操作
- BGM / 効果音
- アニメーション: 落下エフェクト、連鎖数に応じたエフェクト強化

### 12. ビジュアルデザイン仕様

#### 12-1. ぷよの配色

| 色名 | ベース色 | ハイライト色 | グロウ色 |
|------|---------|------------|---------|
| 赤 | `#FF4757` | `#FF8A94` | `rgba(255,71,87,0.7)` |
| 緑 | `#2ED573` | `#7EFFC0` | `rgba(46,213,115,0.7)` |
| 青 | `#3D9FFF` | `#90C8FF` | `rgba(61,159,255,0.7)` |
| 黄 | `#FFD32A` | `#FFE980` | `rgba(255,211,42,0.7)` |

ぷよ円形は `radial-gradient(circle at 35% 30%, light 0%, base 55%, dark 100%)` で描画。目は2つの楕円（白縁付き黒瞳）をぷよ上部に配置。

#### 12-2. ゴーストピース

落下先を示す半透明アウトライン（`border: 2px solid base-color`、`opacity: 0.3`）。ぷよが存在するセルには表示しない。

#### 12-3. セルサイズとボードレイアウト

- セルサイズ: 44×44 px
- ボード全体: 264×528 px（6列×12行）
- ボード背景: `rgba(255,255,255,0.04)` + グロウシャドウ
- セル区切り線: `rgba(255,255,255,0.04)`（右・下ボーダー）

#### 12-4. 全体背景

`linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #0d0d1a 100%)` の濃紺グラデーション。

#### 12-5. タイトルロゴ

4色グラデーション（赤→黄→緑→青）を `background-clip: text` で適用。

#### 12-6. サイドパネル

スコア・レベル・連鎖・NEXTピースを縦並びで表示。幅120 px。各カードは `rgba(255,255,255,0.05)` 背景に accent カラーで値を強調。

| 表示項目 | アクセントカラー |
|---------|---------------|
| SCORE | `#FFD32A` |
| LEVEL | `#3D9FFF` |
| CHAIN | `#FF4757` |
| MAX（2連鎖以上で表示） | `#2ED573` |

#### 12-7. 連鎖ポップアップの色分け

| 連鎖数 | テキストカラー |
|-------|-------------|
| 2連鎖 | `#2ED573`（緑） |
| 3〜4連鎖 | `#FFD32A`（黄） |
| 5連鎖以上 | `#FF4757`（赤） |

文字サイズ 48px・font-weight 900・グロウシャドウ付き。`position: fixed; top: 40%; left: 50%` に表示。

#### 12-8. アニメーション定義（`globals.css`）

| アニメーション名 | 用途 | 詳細 |
|---------------|------|------|
| `puyo-clearing` | 消去時のポップ演出 | 380 ms で拡大→消滅 |
| `chain-popup` | 連鎖数ポップアップ | 浮き上がり＋フェードアウト |
