"""Generate every README figure and the link preview in one editorial style.

Style: white paper, Georgia serif titles, sans labels, red #E3120B and blue #006BA2
accents, slate #6E7A8A, direct labelling, source line on every figure.

    python docs/figures/make_figures.py          # writes docs/*.svg
"""
import collections
import math
import os
import random

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

INK, PAPER, RED, BLUE = "#121212", "#FFFFFF", "#E3120B", "#006BA2"
SLATE, SLATE_T, GREY, RULE, STAND = "#6E7A8A", "#586173", "#B5B5B5", "#D8D8D8", "#3A3A3A"
ACC = {"a": BLUE, "b": RED, "c": SLATE}
SERIF = "Georgia,'Iowan Old Style','Times New Roman',serif"
SANS = "Helvetica,Arial,'Segoe UI',sans-serif"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def t(x, y, s, size=14, fill=INK, family=SANS, weight=400, anchor="start", extra=""):
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>')


def ev_label(x, y, s, i, d, j, size=15, anchor="start", weight=700):
    """A transaction label like a2→b5 with each account in its colour."""
    return t(x, y, f'<tspan fill="{ACC.get(s, INK)}">{s}{i}</tspan><tspan fill="{SLATE}">→</tspan>'
                   f'<tspan fill="{ACC.get(d, INK)}">{d}{j}</tspan>', size=size, anchor=anchor, weight=weight)


def header(w, kicker, title, stand_lines, y=36):
    o = [t(32, y, kicker, 11, SLATE, weight=700, extra='letter-spacing="1.9"'),
         t(32, y + 38, esc(title), 30, INK, SERIF, 700)]
    for k, line in enumerate(stand_lines):
        o.append(t(32, y + 70 + k * 25, esc(line), 18, STAND, SERIF))
    return o, y + 70 + len(stand_lines) * 25


def footer(w, h, lines):
    o = [f'<line x1="32" y1="{h - 22 - 17 * len(lines)}" x2="{w - 32}" y2="{h - 22 - 17 * len(lines)}" stroke="{RULE}"/>']
    for k, line in enumerate(lines):
        o.append(t(32, h - 18 - 17 * (len(lines) - 1 - k), esc(line), 12, SLATE))
    return o


def ann(x, y, w, lines, lead=None):
    """White annotation box with slate border, lead line in bold."""
    rows = ([lead] if lead else []) + lines
    h = 12 + 17 * len(rows)
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="{SLATE}"/>']
    for k, r in enumerate(rows):
        o.append(t(x + 10, y + 20 + 17 * k, esc(r), 12.5, INK, weight=700 if (lead and k == 0) else 400))
    return o, h


def svg(w, h, body):
    return "\n".join([f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
                      f'<rect width="{w}" height="{h}" fill="{PAPER}"/>'] + body + ["</svg>"])


def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(content)


# The six transaction events used throughout the README, in release order.
SIX = [("a", 0, "b", 0), ("b", 1, "c", 0), ("a", 1, "c", 1), ("a", 2, "b", 2), ("c", 2, "b", 3), ("a", 3, "c", 3)]
ARRIVAL = [SIX[3], SIX[5], SIX[1], SIX[4], SIX[0], SIX[2]]


# ---------------------------------------------------------------- figure 1: pipeline
def fig_pipeline():
    W, H = 1000, 650
    o, y0 = header(W, "FIGURE 1", "Where the disorder comes from",
                   ["Each producer owns its accounts and numbers their transactions in order. Anything",
                    "between producer and consumer may reorder them. Osortier puts them back in order."])
    top = y0 + 70
    bot = top + 300
    cols = [(32, 170, "PRODUCERS"), (250, 560, "TRANSPORT AND PROCESSING"), (640, 790, "OSORTIER"), (850, 968, "CONSUMER")]
    for x1, x2, name in cols:
        o.append(t(x1, top - 22, name, 11, SLATE, weight=700, extra='letter-spacing="1.6"'))
    # producers
    prods = [("Producer 1", "accounts a, b"), ("Producer 2", "accounts c, d"), ("Producer 3", "accounts e, f")]
    py = [top + 14, top + 122, top + 230]
    for (n, sub), y in zip(prods, py):
        o.append(f'<rect x="32" y="{y}" width="138" height="56" fill="#fff" stroke="{INK}"/>')
        o.append(t(44, y + 23, n, 14, INK, weight=700))
        o.append(t(44, y + 43, sub, 12.5, SLATE_T))
    # middle systems (grey boxes, strands pass through)
    systems = [(262, top + 22, "Kafka partitions"), (432, top + 96, "retries"), (290, top + 178, "parallel workers"),
               (440, top + 258, "batches in S3")]
    # strands: 18 events leave producers in order, arrive at Osortier shuffled, leave ordered
    rnd = random.Random(11)
    n = 18
    colours = [BLUE, RED, SLATE]
    src_y = [py[k // 6] + 10 + (k % 6) * 7 for k in range(n)]
    perm = list(range(n)); rnd.shuffle(perm)
    in_y = [top + 25 + perm[k] * ((bot - top - 50) / (n - 1)) for k in range(n)]
    out_y = [top + 25 + k * ((bot - top - 50) / (n - 1)) for k in range(n)]
    for k in range(n):
        c = colours[k % 3]
        y1, y2 = src_y[k], in_y[k]
        m1, m2 = 250 + rnd.uniform(0, 120), 430 + rnd.uniform(0, 120)
        ym = rnd.uniform(top + 10, bot - 10)
        o.append(f'<path d="M170 {y1:.1f} C{m1:.0f} {y1:.1f} {m1:.0f} {ym:.1f} {(m1 + m2) / 2:.0f} {ym:.1f} '
                 f'S{m2:.0f} {y2:.1f} 640 {y2:.1f}" fill="none" stroke="{c}" stroke-opacity="0.55" stroke-width="1.6"/>')
        o.append(f'<line x1="790" y1="{out_y[k]:.1f}" x2="850" y2="{out_y[k]:.1f}" stroke="{c}" stroke-opacity="0.8" stroke-width="1.6"/>')
    for x, y, n in systems:
        o.append(f'<rect x="{x}" y="{y}" width="124" height="30" fill="#fff" fill-opacity="0.92" stroke="{SLATE}"/>')
        o.append(t(x + 62, y + 20, n, 12.5, INK, anchor="middle"))
    # osortier and consumer boxes
    o.append(f'<rect x="640" y="{top}" width="150" height="{bot - top}" fill="#fff" stroke="{RED}" stroke-width="2"/>')
    o.append(t(715, (top + bot) / 2 - 8, "Osortier", 18, INK, SERIF, 700, "middle"))
    o.append(t(715, (top + bot) / 2 + 14, "stateless,", 12.5, SLATE_T, anchor="middle"))
    o.append(t(715, (top + bot) / 2 + 30, "one thread, O(n)", 12.5, SLATE_T, anchor="middle"))
    o.append(f'<rect x="850" y="{top}" width="118" height="{bot - top}" fill="#fff" stroke="{INK}"/>')
    o.append(t(909, (top + bot) / 2 - 8, "Applies", 14, INK, weight=700, anchor="middle"))
    o.append(t(909, (top + bot) / 2 + 10, "transactions to", 12.5, SLATE_T, anchor="middle"))
    o.append(t(909, (top + bot) / 2 + 26, "account state", 12.5, SLATE_T, anchor="middle"))
    # requirements under each column
    req = [(32, ["Owns the account state.", "Numbers each account's", "transactions without gaps."]),
           (250, ["At-least-once and unordered.", "Nothing here has to keep order", "or hold a lock."]),
           (640, ["Keeps nothing between runs.", "Needs no database."]),
           (850, ["Needs every account", "in exact sequence."])]
    for x, lines in req:
        for k, line in enumerate(lines):
            o.append(t(x, bot + 24 + 16 * k, esc(line), 12.5, INK if k == 0 else SLATE_T, weight=700 if k == 0 else 400))
    o += footer(W, H, ["Schematic. Strands are transactions, coloured by one of their accounts. Producer and system names are examples."])
    write("fig-pipeline.svg", svg(W, H, o))


# ---------------------------------------------------------------- figure 2: two accounts, sort fails
def fig_two_accounts():
    W, H = 1000, 450
    o, y0 = header(W, "FIGURE 2", "A transaction sits on two accounts, so no sort key works",
                   ["Each transaction has a slot in two independent sequences. Sorting by one side breaks the other."])
    # left: one event on two lanes
    la, lb = y0 + 80, y0 + 170
    for y, k in ((la, "a"), (lb, "b")):
        o.append(f'<line x1="70" y1="{y}" x2="400" y2="{y}" stroke="{GREY}" stroke-width="2"/>')
        o.append(t(40, y + 6, k, 20, ACC[k], SERIF, 700))
    for s in range(4):
        x = 100 + s * 70
        o.append(f'<circle cx="{x}" cy="{la}" r="13" fill="#fff" stroke="{GREY}" stroke-width="1.5"/>')
        o.append(t(x, la + 5, str(s), 12.5, SLATE_T, anchor="middle"))
    for s in range(6):
        x = 100 + s * 56 if s < 6 else 0
    bx = [100 + s * 50 for s in range(6)]
    for s, x in enumerate(bx):
        o.append(f'<circle cx="{x}" cy="{lb}" r="13" fill="#fff" stroke="{GREY}" stroke-width="1.5"/>')
        o.append(t(x, lb + 5, str(s), 12.5, SLATE_T, anchor="middle"))
    xa, xb = 100 + 2 * 70, bx[5]
    o.append(f'<path d="M{xa} {la} C{xa} {(la + lb) / 2} {xb} {(la + lb) / 2} {xb} {lb}" fill="none" stroke="{INK}" stroke-width="2.5"/>')
    o.append(f'<circle cx="{xa}" cy="{la}" r="13" fill="{BLUE}"/>' + t(xa, la + 5, "2", 12.5, "#fff", weight=700, anchor="middle"))
    o.append(f'<circle cx="{xb}" cy="{lb}" r="13" fill="{RED}"/>' + t(xb, lb + 5, "5", 12.5, "#fff", weight=700, anchor="middle"))
    o.append(ev_label(xa - 24, (la + lb) / 2 - 2, "a", 2, "b", 5, 16, "end"))
    o.append(t(xa - 24, (la + lb) / 2 + 16, "3rd transaction on a, 6th on b", 12.5, SLATE_T, anchor="end"))
    o.append(t(32, y0 + 40, "ONE TRANSACTION, TWO ACCOUNTS", 11, SLATE, weight=700, extra='letter-spacing="1.6"'))
    # right: sorted by source breaks c
    o.append(t(480, y0 + 40, "SORTED BY SOURCE ACCOUNT AND SLOT", 11, SLATE, weight=700, extra='letter-spacing="1.6"'))
    order = [("a", 0, "b", 0), ("a", 1, "c", 1), ("a", 2, "b", 2), ("a", 3, "c", 3), ("b", 1, "c", 0), ("c", 2, "b", 3)]
    cy = y0 + 110
    for k, (s, i, d, j) in enumerate(order):
        x = 480 + k * 82
        bad = (s, i) in (("a", 1), ("b", 1))
        o.append(f'<rect x="{x}" y="{cy - 22}" width="72" height="34" fill="#fff" stroke="{RED if bad else GREY}" stroke-width="{2 if bad else 1}"/>')
        o.append(ev_label(x + 36, cy, s, i, d, j, 14, "middle"))
    x1, x2 = 480 + 1 * 82 + 36, 480 + 4 * 82 + 36
    o.append(f'<path d="M{x1} {cy + 14} C{x1} {cy + 60} {x2} {cy + 60} {x2} {cy + 14}" fill="none" stroke="{RED}" stroke-width="1.5"/>')
    a, h = ann(x1 + 40, cy + 70, 250, ["slot 1 on account c goes out before", "slot 0, so account c is out of order"], "c1 before c0")
    o += a
    o += footer(W, H, ["The six example transactions used throughout the README, sorted by (source_key, source_sequence_number)."])
    write("fig-two-accounts.svg", svg(W, H, o))


# ---------------------------------------------------------------- figure 3: the dependency graph
def fig_dag():
    W, H = 1000, 420
    o, y0 = header(W, "FIGURE 3", "Each transaction waits on two others",
                   ["Its parents are the previous slot on each of its accounts. Together the chains form a DAG."])
    cy = y0 + 150
    xs = [90 + k * 160 for k in range(6)]
    edges = [(0, 2, "a"), (0, 1, "b"), (1, 2, "c"), (1, 3, "b"), (2, 3, "a"), (2, 4, "c"), (3, 4, "b"), (3, 5, "a"), (4, 5, "c")]
    for u, v, k in edges:
        x1, x2 = xs[u], xs[v]
        span = v - u
        up = k in ("a", "c")
        hgt = 46 * span + (14 if k == "c" else 0)
        yy = cy - 18 if up else cy + 18
        ctrl = yy - hgt if up else yy + hgt
        o.append(f'<path d="M{x1} {yy} C{x1} {ctrl} {x2} {ctrl} {x2} {yy}" fill="none" stroke="{ACC[k]}" stroke-width="2"/>')
        mx = (x1 + x2) / 2
        my = yy - hgt * 0.75 if up else yy + hgt * 0.75
        o.append(f'<circle cx="{mx}" cy="{my}" r="9" fill="#fff"/>' + t(mx, my + 5, k, 13, ACC[k], SERIF, 700, "middle"))
    for x, (s, i, d, j) in zip(xs, SIX):
        o.append(f'<rect x="{x - 40}" y="{cy - 18}" width="80" height="36" fill="#fff" stroke="{INK}"/>')
        o.append(ev_label(x, cy + 6, s, i, d, j, 15, "middle"))
    o += footer(W, H, ["Edges are labelled with the account that links them. Any topological order of this graph is a valid output."])
    write("fig-dag.svg", svg(W, H, o))


# ---------------------------------------------------------------- figure 4: the loop and its two stores
def chip(x, y, ev, w=66, h=28, stroke=INK, dash=False, fs=13):
    s_, i, d, j = ev
    return [f'<rect x="{x}" y="{y - h / 2}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}"'
            + (' stroke-dasharray="4 3"' if dash else '') + '/>', ev_label(x + w / 2, y + fs * 0.36, s_, i, d, j, fs, "middle")]


def fig_loop():
    W, H = 1000, 920
    o, y0 = header(W, "FIGURE 4", "The whole algorithm",
                   ["Two stores track the preconditions of every waiting transaction: a counter per account and a",
                    "backlog indexed by slot. Each emit can meet at most two preconditions, so it checks two slots."])
    o.insert(0, f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{INK}"/></marker></defs>')
    cy = y0 + 110

    def box(x, w, lines, stroke=INK, y=cy):
        r = [f'<rect x="{x}" y="{y - 30}" width="{w}" height="60" fill="#fff" stroke="{stroke}"/>']
        for k, (txt, bold) in enumerate(lines):
            r.append(t(x + w / 2, y - 4 + 18 * k - (9 * (len(lines) - 1) - 9), esc(txt), 13.5 if bold else 12.5,
                       INK if bold else SLATE_T, weight=700 if bold else 400, anchor="middle"))
        return r
    o += box(32, 150, [("next transaction", True), ("from the input", False)])
    dx, dw = 300, 90
    o.append(f'<path d="M{dx - dw} {cy} L{dx} {cy - 52} L{dx + dw} {cy} L{dx} {cy + 52} Z" fill="#fff" stroke="{RED}" stroke-width="2"/>')
    o.append(t(dx, cy - 4, "ready?", 14, INK, weight=700, anchor="middle"))
    o.append(t(dx, cy + 14, "both preconditions met", 11.5, SLATE_T, anchor="middle"))
    o += box(470, 190, [("emit", True), ("advance both counters", False)])
    o += box(740, 228, [("wake", True), ("look up the next slot", False), ("on each of its accounts", False)])
    o += box(dx - 95, 190, [("park", True), ("store under both slots", False)], y=cy + 125)
    arrow = f'stroke="{INK}" stroke-width="1.5" fill="none" marker-end="url(#ah)"'
    o.append(f'<line x1="182" y1="{cy}" x2="{dx - dw - 2}" y2="{cy}" {arrow}/>')
    o.append(f'<line x1="{dx + dw}" y1="{cy}" x2="468" y2="{cy}" {arrow}/>' + t(dx + dw + 30, cy - 8, "yes", 12.5, SLATE_T, anchor="middle"))
    o.append(f'<line x1="{dx}" y1="{cy + 52}" x2="{dx}" y2="{cy + 93}" {arrow}/>' + t(dx + 10, cy + 78, "no", 12.5, SLATE_T))
    o.append(f'<line x1="660" y1="{cy}" x2="738" y2="{cy}" {arrow}/>')
    o.append(f'<path d="M854 {cy - 30} C854 {cy - 80} 565 {cy - 80} 565 {cy - 32}" {arrow}/>')
    o.append(t(710, cy - 70, "found and now ready: emit it too", 12.5, SLATE_T, anchor="middle"))
    o.append(f'<path d="M854 {cy + 30} L854 {cy + 200} L80 {cy + 200} L80 {cy + 32}" {arrow}/>')
    o.append(t(600, cy + 192, "nothing ready: back to the next transaction", 12.5, SLATE_T, anchor="middle"))
    o.append(f'<path d="M{dx - 95} {cy + 125} L134 {cy + 125} L134 {cy + 32}" {arrow}/>')

    # the two stores, as they stand after the fifth arrival of the example
    sy = cy + 250
    o.append(f'<line x1="32" y1="{sy - 18}" x2="968" y2="{sy - 18}" stroke="{RULE}"/>')
    o.append(t(32, sy + 8, "THE TWO STORES, AFTER THE FIFTH ARRIVAL", 11, SLATE, weight=700, extra='letter-spacing="1.6"'))
    cx0, ctop = 32, sy + 30
    o.append(f'<rect x="{cx0}" y="{ctop}" width="250" height="206" fill="#fff" stroke="{INK}"/>')
    o.append(t(cx0 + 14, ctop + 24, "Counters", 15, INK, SERIF, 700))
    o.append(t(cx0 + 14, ctop + 42, "next slot each account expects", 12, SLATE_T))
    o.append(t(cx0 + 14, ctop + 58, "read by ready?, advanced by emit", 12, SLATE_T))
    for k, (acc, v) in enumerate((("a", 1), ("b", 2), ("c", 1))):
        yy = ctop + 100 + k * 38
        o.append(f'<line x1="{cx0 + 14}" y1="{yy + 12}" x2="{cx0 + 236}" y2="{yy + 12}" stroke="{RULE}"/>')
        o.append(t(cx0 + 20, yy, acc, 20, ACC[acc], SERIF, 700))
        o.append(t(cx0 + 220, yy, str(v), 20, INK, SANS, 700, "end"))
    bx0, bw = 312, 656
    o.append(f'<rect x="{bx0}" y="{ctop}" width="{bw}" height="206" fill="#fff" stroke="{INK}"/>')
    o.append(t(bx0 + 14, ctop + 24, "Backlog", 15, INK, SERIF, 700))
    o.append(t(bx0 + 14, ctop + 42, "waiting transactions, stored under both of their slots", 12, SLATE_T))
    o.append(t(bx0 + 14, ctop + 58, "written by park, looked up by wake, cleared by emit", 12, SLATE_T))
    for x, n in [(bx0 + 14, "STORED AT"), (bx0 + 150, "TRANSACTION"), (bx0 + 270, "SOURCE PRECONDITION"), (bx0 + 460, "DESTINATION PRECONDITION")]:
        o.append(t(x, ctop + 86, n, 10.5, SLATE, weight=700, extra='letter-spacing="1.2"'))
    rows = [(("a", 2, "b", 2), [("a", 2, 1), ("b", 2, 2)]),
            (("a", 3, "c", 3), [("a", 3, 1), ("c", 3, 1)]),
            (("c", 2, "b", 3), [("c", 2, 1), ("b", 3, 2)])]
    for k, (ev, pre) in enumerate(rows):
        yy = ctop + 114 + k * 32
        s_, i, d, j = ev
        o.append(t(bx0 + 14, yy + 5, f'<tspan fill="{ACC[s_]}">{s_}{i}</tspan><tspan fill="{SLATE}"> and </tspan><tspan fill="{ACC[d]}">{d}{j}</tspan>', 13.5, weight=700))
        o += chip(bx0 + 150, yy, ev)
        for (acc, need, have), x in zip(pre, (bx0 + 270, bx0 + 460)):
            met = have == need
            o.append(f'<circle cx="{x + 7}" cy="{yy}" r="6" fill="{INK if met else "#fff"}" stroke="{INK}" stroke-width="1.5"/>')
            label = f"{acc} at {need}: met" if met else f"{acc} at {need}: waiting, {acc} is at {have}"
            o.append(t(x + 20, yy + 4.5, esc(label), 12.5, INK if met else SLATE_T, weight=700 if met else 400))
    o.append(f'<rect x="{bx0 + 264}" y="{ctop + 101}" width="184" height="26" fill="none" stroke="{RED}" stroke-width="1.5"/>')
    a, h = ann(312, ctop + 222, 656, ["Sixth arrival: a1→c1 goes out and a moves to 2. That meets the last open precondition",
                                      "of a2→b2, and wake finds it stored at a2. It goes out, b moves to 3, and c2→b3",
                                      "is released the same way."],
               "How a precondition is released")
    o += a
    o += footer(W, H, ["go/main.go, go/backlog.go, go/sequenceCounter.go. Filled dot: precondition met. Hollow dot: still waiting."])
    write("fig-loop.svg", svg(W, H, o))


# ---------------------------------------------------------------- figure 5: deployment
def fig_deploy():
    W, H = 1000, 470
    o, y0 = header(W, "FIGURE 5", "The demo deployment",
                   ["Three Go Lambdas behind one REST API. S3 holds the session files and the site."])
    o.insert(0, f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{SLATE}"/></marker></defs>')
    def box(x, y, w, h, title, sub, stroke=INK):
        return [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fff" stroke="{stroke}" stroke-width="{2 if stroke == RED else 1}"/>',
                t(x + w / 2, y + h / 2 - 3, esc(title), 14, INK, weight=700, anchor="middle"),
                t(x + w / 2, y + h / 2 + 15, esc(sub), 12, SLATE_T, anchor="middle")]
    top = y0 + 40
    o += box(32, top + 70, 130, 60, "Browser", "demo website")
    o += box(220, top + 70, 150, 60, "API Gateway", "REST API OSortier")
    o += box(450, top, 170, 50, "gen", "POST /events")
    o += box(450, top + 75, 170, 50, "sort", "POST /sort", RED)
    o += box(450, top + 150, 170, 50, "get", "GET /events")
    o += box(720, top + 60, 240, 80, "S3 osortiereventstore", "session files, expire after 1 day")
    o += box(220, top + 175, 150, 50, "S3 osortierdemosite", "index and assets")
    arrow = f'stroke="{SLATE}" stroke-width="1.3" fill="none" marker-end="url(#ah)"'
    o.append(f'<line x1="162" y1="{top + 100}" x2="218" y2="{top + 100}" {arrow}/>')
    for yy in (top + 25, top + 100, top + 175):
        o.append(f'<path d="M370 {top + 100} C410 {top + 100} 410 {yy} 448 {yy}" {arrow}/>')
    o.append(f'<line x1="295" y1="{top + 130}" x2="295" y2="{top + 173}" {arrow}/>')
    o.append(f'<path d="M620 {top + 25} C680 {top + 25} 670 {top + 80} 718 {top + 80}" {arrow}/>' + t(690, top + 24, "unsorted", 11.5, SLATE_T, anchor="middle"))
    o.append(f'<line x1="620" y1="{top + 100}" x2="718" y2="{top + 100}" {arrow}/>' + t(668, top + 94, "sorted", 11.5, SLATE_T, anchor="middle"))
    o.append(f'<path d="M620 {top + 175} C680 {top + 175} 670 {top + 122} 718 {top + 122}" {arrow}/>' + t(690, top + 180, "URL", 11.5, SLATE_T, anchor="middle"))
    o += footer(W, H, ["cdk/lib/cdk-stack.ts. All functions are Go on provided.al2023, x86_64, 29 s timeout. Buckets are public: demo data only."])
    write("fig-deploy.svg", svg(W, H, o))


# ---------------------------------------------------------------- link preview: shuffled events and the forest
def simulate(K, N, seed):
    rnd = random.Random(seed)
    cnt, last, ev = collections.Counter(), {}, []
    for _ in range(N):
        a, b = rnd.sample(range(K), 2)
        ev.append(dict(s=a, si=cnt[a], d=b, di=cnt[b], par=[(last.get(a), a), (last.get(b), b)]))
        cnt[a] += 1; cnt[b] += 1
        last[a] = last[b] = len(ev) - 1
    return ev


def og_image():
    W, H = 1200, 630
    K, GENS = 96, 11
    ev = simulate(K, 6000, 3)
    ch = collections.defaultdict(list)
    for i, e in enumerate(ev):
        for p, _ in e["par"]:
            if p is not None:
                ch[p].append(i)
    gen, levels = {0: 0, 1: 0}, [[0, 1]]
    for g in range(1, GENS + 1):
        nxt = []
        for u in levels[-1]:
            for v in ch[u]:
                if v not in gen:
                    gen[v] = g; nxt.append(v)
        levels.append(nxt)
    names = []
    for lv in levels:
        for v in lv:
            for a in (ev[v]["s"], ev[v]["d"]):
                if a not in names:
                    names.append(a)
    for e in ev:
        for a in (e["s"], e["d"]):
            if a not in names:
                names.append(a)
    def nm(a):
        i = names.index(a); return chr(97 + i) if i < 26 else chr(96 + i // 26) + chr(97 + i % 26)
    PAL = [BLUE, RED, SLATE, "#5FA3CC", "#F08A84", GREY]
    def col(a):
        i = names.index(a); return {0: BLUE, 1: RED, 2: SLATE}.get(i, PAL[i % len(PAL)])
    rnd = random.Random(7)
    X = [470, 640, 760]; dx = 92
    for g in range(3, GENS + 1):
        X.append(X[-1] + dx); dx *= 0.80
    CY = 470
    pos = {}
    for g, lv in enumerate(levels):
        span = min(560, 62 * 1.55 ** g) if g > 1 else (90 if g == 0 else 120)
        def bary(v):
            ps = [pos[p][1] for p, _ in ev[v]["par"] if p in pos and gen.get(p, 99) < g]
            return sum(ps) / len(ps) if ps else CY
        lv.sort(key=bary)
        for k, v in enumerate(lv):
            y = CY + (0 if len(lv) == 1 else (k / (len(lv) - 1) - 0.5) * span)
            jit = 0.9 * g * g
            pos[v] = (X[g] + rnd.uniform(-jit, jit) * 0.6, y + rnd.uniform(-jit, jit))
    HW = {0: 62, 1: 46}
    o = []
    edges = []
    for v, g in gen.items():
        for p, acc in ev[v]["par"]:
            if g and p is not None and p in gen and gen[p] < g:
                edges.append((gen[p], p, v, acc, g))
    for gp, p, v, acc, g in sorted(edges, key=lambda e: -e[0]):
        (x1, y1), (x2, y2) = pos[p], pos[v]
        x1 += HW.get(gp, 0); x2 -= HW.get(g, 0)
        op = max(0.08, 0.9 * 0.78 ** gp); w = max(0.5, 2.6 * 0.82 ** gp)
        mx = (x1 + x2) / 2
        o.append(f'<path d="M{x1:.1f} {y1:.1f} C{mx:.1f} {y1:.1f} {mx:.1f} {y2:.1f} {x2:.1f} {y2:.1f}" fill="none" '
                 f'stroke="{col(acc)}" stroke-opacity="{op:.3f}" stroke-width="{w:.2f}"/>')
    for v, g in sorted(gen.items(), key=lambda kv: -kv[1]):
        x, y = pos[v]; e = ev[v]
        if g <= 1:
            w, h, fs = (124, 36, 18) if g == 0 else (92, 28, 14)
            o.append(f'<rect x="{x - w / 2:.1f}" y="{y - h / 2:.1f}" width="{w}" height="{h}" fill="#fff" stroke="{INK if g == 0 else SLATE}"/>')
            o.append(t(f"{x:.1f}", f"{y + fs * 0.36:.1f}",
                       f'<tspan fill="{col(e["s"])}">{nm(e["s"])}{e["si"]}</tspan><tspan fill="{SLATE}">→</tspan>'
                       f'<tspan fill="{col(e["d"])}">{nm(e["d"])}{e["di"]}</tspan>', fs, weight=700, anchor="middle"))
        else:
            r = max(0.7, 8 * 0.78 ** (g - 2)); op = max(0.15, 0.95 * 0.83 ** (g - 2))
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="{col(e["s"])}" fill-opacity="{op:.2f}" '
                     f'stroke="{col(e["d"])}" stroke-opacity="{op:.2f}" stroke-width="{max(0.4, r * 0.45):.2f}"/>')
    for _ in range(420):
        x = rnd.uniform(X[-1] - 10, W + 10); spread = (x - 900) * 1.1 + 120
        y = CY + rnd.gauss(0, 1) * spread * 0.55
        if 250 < y < 600:
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.uniform(0.4, 1.2):.2f}" fill="{rnd.choice(PAL)}" fill-opacity="{rnd.uniform(0.1, 0.4):.2f}"/>')
    o.append('<defs><linearGradient id="veil" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>'
             '<stop offset="1" stop-color="#fff" stop-opacity="0.6"/></linearGradient></defs>'
             f'<rect x="920" y="0" width="280" height="{H}" fill="url(#veil)"/>')
    # text and the shuffled input
    o.append(f'<rect width="{W}" height="6" fill="{RED}"/>')
    o.append(t(56, 64, "OSORTIER · IN-ORDER PROCESSING FOR EVENT-DRIVEN SYSTEMS", 14, SLATE, weight=700, extra='letter-spacing="2.4"'))
    o.append(t(56, 124, "Transactions, back in order", 52, INK, SERIF, 700))
    o.append(t(56, 168, "Every transaction waits on two accounts. A stateless, single-threaded", 23, STAND, SERIF))
    o.append(t(56, 198, "pass puts them back in order in O(n), with no database behind it.", 23, STAND, SERIF))
    o.append(f'<line x1="56" y1="228" x2="1144" y2="228" stroke="{RULE}"/>')
    o.append(t(56, 268, "ARRIVES SHUFFLED", 13, SLATE, weight=700, extra='letter-spacing="2"'))
    o.append(t(408, 268, "WHAT WAITS ON TWO TRANSACTIONS", 13, SLATE, weight=700, extra='letter-spacing="2"'))
    for k, ((s, i, d, j), r) in enumerate(zip(ARRIVAL, (-2, 1.6, -1.2, 2, -1.6, 1.2))):
        x, y = (56, 84, 62, 88, 60, 86)[k], 288 + k * 48
        o.append(f'<g transform="translate({x} {y}) rotate({r})"><rect width="196" height="38" fill="#fff" stroke="{SLATE}"/>'
                 + ev_label(98, 26, s, i, d, j, 22, "middle") + "</g>")
    a, _ = ann(712, 268 + 14, 236, ["Their dependants roughly double", "each generation, then blur together."], "Two root transactions")
    o += a
    o.append(t(56, 616, "Forest: simulation of the generator's model, 96 accounts, descendants of the first two transactions by generation.", 12.5, SLATE))
    write("og-image.svg", svg(W, H, o))


if __name__ == "__main__":
    fig_pipeline(); fig_two_accounts(); fig_dag(); fig_loop(); fig_deploy(); og_image()
    print("written to", os.path.normpath(OUT))
