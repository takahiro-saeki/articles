---
title: "How many days of article stock remain? Count bilingual pairs against platform slots"
published: false
tags: writing, python, productivity
canonical_url: null
---

Having 136 Japanese and English manuscript files does not provide 136 days of stock. Two language versions of the same content form one pair. Under this production policy, a verified body with an unresolved canonical URL also does not count as a completed pair.

To count days, establish the usable pairs and each platform's daily requirement. This investigation reads the actual production ledger and performs local allocation against hypothetical publishing slots.

## Fix the commit and the meaning of a pair

On September 11, 2026, the [production ledger](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/production/2026-09/catalog.json) at commit `6fe4649` in `articles` was checked against the existence of its manuscripts. The scope is only the 90 new candidates. Previously published articles are excluded from stock.

| Verified ledger item | Count |
| --- | ---: |
| Body, translation, and Humanizer checks complete | 68 pairs |
| Files for those pairs | 136 files |
| Drafts complete including their URLs | 41 pairs |
| Waiting for canonical URLs | 27 pairs |
| Candidates still requiring body verification | 22 |

All 41 completed pairs target Zenn. The 27 Qiita pairs lack article IDs. This does not mean that Qiita manuscripts cannot be prepared; it means there are no pairs with resolved Japanese/English URLs in that group at this snapshot.

Reporting 68 days by dividing 68 pairs by one pair per day would mix the 27 unresolved pairs into available completed stock.

## Publishing slots change the answer

The inventory contains 41 completed Zenn pairs and 0 completed Qiita pairs. It was allocated under the following 4 hypothetical conditions. No real schedule was created.

| Hypothetical publishing slots | Consecutive days fully covered |
| --- | ---: |
| 1 Zenn pair every day | 41 days |
| 2 Zenn pairs every day | 20 days |
| Alternate Qiita and Zenn, starting with 1 Qiita pair | 0 days |
| Alternate Zenn and Qiita, starting with 1 Zenn pair | 1 day |

The second row consumes 40 of the 41 pairs. The remaining 1 cannot fill the next day's 2 slots. Alternating platforms stops at the first Qiita slot despite the larger Zenn inventory.

Dividing combined stock by an average frequency hides that shortage. When platform requirements are fixed, allocate the required count in chronological order.

## Stop at the first day that cannot be filled

This is the function used in the check. Each element of `plan` specifies one day's requirements by platform; counts are assumed to be positive integers.

```python
def covered_days(available, plan):
    remaining=available.copy(); days=0
    for needs in plan:
        if any(remaining.get(platform,0)<count for platform,count in needs.items()): break
        for platform,count in needs.items(): remaining[platform]-=count
        days+=1
    return days
```

The function does not count a partially filled day as successful. It consumes inventory only when every slot for the day can be filled. The result counts consecutive days with enough manuscripts.

The 4 conditions were checked against expected results. This small calculation does not consider freshness, seasonality, series order, or repetition of the same topic. Matching the platform does not establish that an article fits that day's readers.

## Count scheduled days separately

The [publishing schedule](https://github.com/takahiro-saeki/articles/blob/6fe464919b7fba46d27395668d39d1e44b7f6964/schedule/publishing-schedule.json) at the same commit contains 38 rows, dated August 3 through September 9, 2026. It has 0 rows on or after September 11. None of the 90 new candidate manuscripts was added to it.

The result is therefore 41 days of completed manuscripts under one hypothetical condition, and 0 days in the future schedule. The 41 completed pairs have not become scheduled pairs. This count also does not investigate whether all 38 historical rows were published at their intended times.

Separating body verification, URL resolution, and schedule allocation changes the next action. A body shortage calls for writing; an unresolved URL calls for the stage that can establish it. During a period when scheduling is intentionally disabled, an empty schedule need not be mistaken for a manuscript shortage.

The [inventory audit and 4 allocation examples](https://github.com/takahiro-saeki/articles/blob/codex/article-stock-2026-09/experiments/article-stock-2026-09/audit-production-batch12.py) read the fixed commit in Python without modifying the schedule. These days are neither a guarantee of successful publication nor a prediction of writing speed. They express how far completed stock can fill explicitly defined slots.
