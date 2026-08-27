#!/usr/bin/env python3
# ============================================================
# CAwiki 하드웨어 그래프 빌드
#   입력: tools/hardware-research.json (노드 원천, 병합 연구본)
#         tools/hardware-edges.json    (115 엣지, 양방향 이유)
#   출력: data/hardware-graph.json     (그래프 뷰 런타임 소스)
#
# 실행: python3 tools/build_graph.py
# ============================================================
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RESEARCH = os.path.join(HERE, "hardware-research.json")
EDGES = os.path.join(HERE, "hardware-edges.json")
PART_LINKS = os.path.join(HERE, "hardware-part-links.json")
OUT_DIR = os.path.join(ROOT, "data")
OUT = os.path.join(OUT_DIR, "hardware-graph.json")

# 그래프 뷰가 쓰는 노드 필드만 추린다(원천은 그대로 보존).
NODE_FIELDS = ["id", "name_ko", "name_en", "category", "one_line", "role"]

# 카테고리 정규화 — 방사형 섹터 배치에 쓰는 6개 표준 분류로 통일.
CATEGORIES = ["연산", "메모리", "저장장치", "기판·버스·전원", "입출력", "네트워크"]


def norm_category(c):
    base = re.sub(r"\s*\(.*?\)", "", c or "").strip()   # '연산 (Processing)' → '연산'
    head = base.split("·")[0]
    for full in CATEGORIES:
        if full == base or full.split("·")[0] == head:
            return full
    return base


def slim_parts(parts):
    return [{"part": p["part"], "role": p["role"]} for p in (parts or [])]


def slim_steps(steps):
    return [{"step": s["step"], "detail": s["detail"]} for s in (steps or [])]


def slim_concepts(cs):
    return [{"term": c["term"], "explanation": c["explanation"]} for c in (cs or [])]


def main():
    research = json.load(open(RESEARCH, encoding="utf-8"))
    edges = json.load(open(EDGES, encoding="utf-8"))

    nodes = []
    for d in research:
        n = {k: d.get(k) for k in NODE_FIELDS}
        n["category"] = norm_category(n.get("category"))
        n["parts"] = slim_parts(d.get("parts"))
        n["how_it_works"] = slim_steps(d.get("how_it_works"))
        n["key_concepts"] = slim_concepts(d.get("key_concepts"))
        nodes.append(n)

    ids = {n["id"] for n in nodes}
    # 엣지 정합성 검사(그래프 뷰가 신뢰할 수 있도록)
    bad = [e for e in edges if e["a"] not in ids or e["b"] not in ids or e["a"] == e["b"]]
    assert not bad, f"잘못된 엣지: {bad[:3]}"
    # 무방향 중복 검사
    seen = set()
    for e in edges:
        key = frozenset((e["a"], e["b"]))
        assert key not in seen, f"중복 엣지: {e['a']}-{e['b']}"
        seen.add(key)

    # 부품 상호작용 링크 병합 — 인덱스 범위·자기참조·중복 검증
    plinks = json.load(open(PART_LINKS, encoding="utf-8")) if os.path.exists(PART_LINKS) else {}
    n_links = 0
    for n in nodes:
        raw = plinks.get(n["id"], [])
        np_ = len(n["parts"])
        seen_l, links = set(), []
        for pair in raw:
            i, j = pair[0], pair[1]
            assert 0 <= i < np_ and 0 <= j < np_, f"{n['id']}: 링크 인덱스 범위 밖 {pair} (parts {np_}개)"
            assert i != j, f"{n['id']}: 자기참조 링크 {pair}"
            key = frozenset((i, j))
            assert key not in seen_l, f"{n['id']}: 중복 링크 {pair}"
            seen_l.add(key)
            links.append([i, j])
        n["part_links"] = links
        n_links += len(links)

    # 노드별 차수(뷰에서 반경·라벨 밀도 적응에 사용)
    deg = {i: 0 for i in ids}
    for e in edges:
        deg[e["a"]] += 1
        deg[e["b"]] += 1
    for n in nodes:
        n["degree"] = deg[n["id"]]

    graph = {
        "meta": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "generated_by": "tools/build_graph.py",
        },
        "nodes": nodes,
        "edges": edges,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(graph, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"빌드 완료: {OUT}")
    print(f"  노드 {len(nodes)} · 엣지 {len(edges)} · 부품링크 {n_links}")
    print(f"  차수 상위: " + ", ".join(
        f"{n['id']}={n['degree']}" for n in sorted(nodes, key=lambda x: -x['degree'])[:5]))


if __name__ == "__main__":
    main()
