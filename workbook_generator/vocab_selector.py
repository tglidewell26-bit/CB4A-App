from __future__ import annotations

import json
import re
import sys
from collections import Counter
from typing import Dict, List

# Grade-banded target vocabulary pools (grades 3-8).
GRADE_VOCAB: Dict[int, List[str]] = {
    3: [
        "Ability", "absorb", "accuse", "act", "active", "actual", "adopt", "advantage",
        "advice", "ambition", "ancient", "approach", "arrange", "arctic", "attitude", "attract",
        "average", "avoid", "Bold", "border", "brief", "brilliant", "Cable", "capture",
        "certain", "chill", "clever", "climate", "cling", "coast", "confess", "consider",
        "contain", "continent", "convince", "coward", "crew", "crumple", "custom", "Decay",
        "deed", "defend", "delicate", "device", "diagram", "digest", "disease", "distant",
        "doze", "drift", "Elegant", "enable", "examine", "explore", "Fan", "fatal",
        "fierce", "flutter", "fortunate", "frail", "Gasp", "glide", "globe", "grace",
        "gradual", "grasp", "Habit", "harsh", "Imitate", "individual", "intelligent", "intend",
        "Journey", "Launch", "limit", "locate", "loyal", "Magnificent", "marsh", "method",
        "misery", "moisture", "mural", "mystify", "Nation", "nectar", "nursery", "Observe",
        "opponent", "opposite", "ordeal", "origin", "outcome", "Passage", "pastime", "pause",
        "perform", "plunge", "predator", "predict", "prevent", "primary", "privilege", "process",
        "Rare", "rate", "recall", "rely", "remark", "resident", "respect", "responsible",
        "reverse", "revive", "risk", "Scatter", "schedule", "sensitive", "signal", "solution",
        "spoil", "starve", "steer", "struggled", "suitable", "survey", "swift", "symbol",
        "Talent", "theory", "thrill", "treasure", "triumph", "Value", "vision", "volunteer",
        "Wander", "wisdom", "wit", "woe",
    ],
    4: [
        "accurate", "address", "afford", "alert", "analyze", "ancestor", "annual", "apparent",
        "appropriate", "arena", "arrest", "ascend", "assist", "attempt", "attentive", "attractive",
        "awkward", "baggage", "basic", "benefit", "blend", "blossom", "burrow", "calculate",
        "capable", "captivity", "carefree", "century", "chamber", "circular", "coax", "column",
        "communicate", "competition", "complete", "concentrate", "concern", "conclude", "confuse", "congratulate",
        "considerable", "content", "contribute", "crafty", "create", "demonstrate", "descend", "desire",
        "destructive", "develop", "disaster", "disclose", "distract", "distress", "dusk", "eager",
        "ease", "entertain", "entire", "entrance", "envy", "essential", "extraordinary", "flexible",
        "focus", "fragile", "frantic", "frequent", "frontier", "furious", "generosity", "hail",
        "hardship", "heroic", "host", "humble", "Impact", "increase", "indicate", "inspire",
        "instant", "invisible", "jagged", "lack", "limb", "limp", "manufacture", "master",
        "mature", "meadow", "mistrust", "mock", "modest", "noble", "orchard", "outstanding",
        "peculiar", "peer", "permit", "plead", "plentiful", "pointless", "portion", "practice",
        "precious", "prefer", "prepare", "proceed", "queasy", "recent", "recognize", "reduce",
        "release", "represent", "request", "resist", "response", "reveal", "routine", "severe",
        "shabby", "shallow", "sole", "source", "sturdy", "surface", "survive", "terror",
        "threat", "tidy", "tour", "tradition", "tragic", "typical", "vacant", "valiant",
        "variety", "vast", "venture", "weary",
    ],
    5: [
        "Abolish", "absurd", "abuse", "access", "accomplish", "achievement", "aggressive", "alternate",
        "altitude", "antagonist", "antonym", "anxious", "apparent", "approximate", "aroma", "assume",
        "astound", "available", "avalanche", "Banquet", "beverage", "bland", "blizzard", "budge",
        "bungle", "Cautiously", "challenge", "character", "combine", "companion", "crave", "compassion",
        "compensate", "comply", "compose", "concept", "confident", "convert", "course", "courteous",
        "Debate", "decline", "dedicate", "deprive", "detect", "dictate", "document", "duplicate",
        "Edible", "endanger", "escalate", "evade", "exasperate", "excavate", "exert", "exhibit",
        "exult", "Feeble", "frigid", "Gigantic", "gorge", "guardian", "Hazy", "hearty",
        "homonym", "Identical", "illuminate", "immense", "impressive", "independent", "industrious", "intense",
        "intercept", "Jubilation", "Kin", "Luxurious", "Major", "miniature", "minor", "mischief",
        "monarch", "moral", "myth", "Narrator", "navigate", "negative", "nonchalant", "numerous",
        "Oasis", "obsolete", "occasion", "overthrow", "Pardon", "pasture", "pedestrian", "perish",
        "petrify", "portable", "prefix", "preserve", "protagonist", "provide", "purchase", "Realistic",
        "reassure", "reign", "reliable", "require", "resemble", "retain", "retire", "revert",
        "route", "Saunter", "seldom", "senseless", "sever", "slither", "sluggish", "soar",
        "solitary", "solo", "sparse", "spurt", "strategy", "suffix", "suffocate", "summit",
        "suspend", "synonym", "Talon", "taunt", "thrifty", "translate", "tropical", "Visible",
        "visual", "vivid", "Wilderness", "withdraw",
    ],
    6: [
        "Abate", "abnormal", "abode", "abrupt", "accelerate", "acclaim", "acknowledge", "acquire",
        "aspire", "acrid", "addict", "adjacent", "admonish", "affliction", "agitate", "ajar",
        "akin", "allege", "annihilate", "anonymous", "antagonize", "apathy", "arbitrate", "astute",
        "authentic", "avert", "Bellow", "beseech", "bestow", "bewilder", "bigot", "blatant",
        "bleak", "braggart", "brawl", "browse", "bystander", "Candid", "canine", "canny",
        "capricious", "capsize", "casual", "casualty", "catastrophe", "cater", "chorus", "citrus",
        "clamber", "climax", "compromise", "concur", "confront", "congested", "conjure", "consult",
        "corrupt", "counterfeit", "covet", "customary", "Debut", "deceased", "dependent", "despondent",
        "detach", "devour", "dishearten", "dismal", "dismantle", "distraught", "docile", "downright",
        "drone", "dumbfound", "Emblem", "endure", "ensue", "enthrall", "epidemic", "erode",
        "exuberant", "Fathom", "feud", "figment", "firebrand", "flabbergast", "flagrant", "flaw",
        "fruitless", "Gaudy", "geography", "gratify", "gravity", "grim", "grimy", "grueling",
        "gruesome", "Haggle", "headlong", "hilarious", "homage", "homicide", "hospitable", "hurtle",
        "hybrid", "Illiterate", "impede", "implore", "incident", "incredulous", "infamous", "infuriate",
        "insinuate", "intensified", "inundate", "irate", "Lavish", "legacy", "legitimate", "lethal",
        "loath", "lurk", "Magnetic", "mirth", "quench", "magnitude", "maternal", "maul",
        "melancholy", "mellow", "momentum", "mortify", "mull", "murky", "Narrative", "negligent",
        "nimble", "nomadic", "noteworthy", "notify", "notorious", "nurture", "Obnoxious", "oration",
        "orthodox", "overwhelm", "Pamper", "patronize", "peevish", "pelt", "pending", "perceived",
        "perjury", "permanent", "persist", "perturb", "pique", "pluck", "poised", "ponder",
        "potential", "predatory", "presume", "preview", "prior", "prowess", "Radiant", "random",
        "rant", "recede", "reprimand", "resume", "retort", "robust", "rupture", "Saga",
        "sequel", "sham", "shirk", "simultaneously", "snare", "species", "status", "stodgy",
        "substantial", "subtle", "sullen", "supervise", "Tamper", "throb", "toxic", "tragedy",
        "trickle", "trivial", "Uncertainty", "unscathed", "upright", "urgent", "utmost", "Vengeance",
        "vicious", "vindictive", "vista", "vocation", "void", "Wary", "whim", "wince",
        "wrath", "Yearn",
    ],
    7: [
        "Abet", "accord", "adept", "advocate", "agile", "allot", "aloof", "amiss",
        "analogy", "anarchy", "antics", "apprehend", "ardent", "articulate", "assail", "assimilate",
        "atrocity", "attribute", "audacious", "augment", "authority", "avail", "avid", "awry",
        "Balmy", "banter", "barter", "benign", "bizarre", "blasé", "bonanza", "bountiful",
        "Cache", "capacious", "caption", "chastise", "citadel", "cite", "clad", "clarify",
        "commemorate", "component", "concept", "confiscate", "connoisseur", "conscientious", "conservative", "contagious",
        "conventional", "convey", "crucial", "crusade", "culminate", "Deceptive", "decipher", "decree",
        "deface", "defect", "deplore", "deploy", "desist", "desolate", "deter", "dialect",
        "dire", "discern", "disdain", "disgruntled", "dispatch", "disposition", "doctrine", "dub",
        "durable", "Eccentric", "elite", "embargo", "embark", "encroach", "endeavor", "enhance",
        "enigma", "epoch", "era", "eventful", "evolve", "exceptional", "excerpt", "excruciating",
        "exemplify", "exotic", "Facilitate", "fallacy", "fastidious", "feasible", "fend", "ferret",
        "flair", "flustered", "foreboding", "forfeit", "formidable", "fortify", "foster", "Gaunt",
        "gingerly", "glut", "grapple", "grope", "gullible", "Haggard", "haven", "heritage",
        "hindrance", "hover", "humane", "Imperative", "inaugurate", "incense", "indifferent", "infinite",
        "instill", "institute", "intervene", "intricate", "inventive", "inventory", "irascible", "Jurisdiction",
        "Languish", "legendary", "liberal", "loll", "lucrative", "luminous", "Memoir", "mercenary",
        "mien", "millennium", "minimize", "modify", "muse", "muster", "Onslaught", "ornate",
        "ovation", "overt", "Pang", "panorama", "perspective", "phenomenon", "pioneer", "pithy",
        "pivotal", "plausible", "plunder", "porous", "preposterous", "principal", "prodigy", "proficient",
        "profound", "pseudonym", "pungent", "Rankle", "rational", "rebuke", "reception", "recourse",
        "recur", "renounce", "renown", "revenue", "rubble", "rue", "Sage", "sedative",
        "serene", "servile", "shackle", "sleek", "spontaneous", "sporadic", "stamina", "stance",
        "staple", "stint", "strident", "sublime", "subside", "succumb", "surpass", "susceptible",
        "swelter", "Tedious", "teem", "theme", "tirade", "tract", "transition", "trepidation",
        "turbulent", "tycoon", "Ultimate", "ungainly", "Vice versa", "vie", "vilify", "voracious",
        "Wage", "wrangle",
    ],
    8: [
        "Abet", "accord", "adept", "advocate", "agile", "allot", "aloof", "amiss",
        "analogy", "anarchy", "antics", "apprehend", "ardent", "articulate", "assail", "assimilate",
        "atrocity", "attribute", "audacious", "augment", "authority", "avail", "avid", "awry",
        "Balmy", "banter", "barter", "benign", "bizarre", "blasé", "bonanza", "bountiful",
        "Cache", "capacious", "caption", "chastise", "citadel", "cite", "clad", "clarify",
        "commemorate", "component", "concept", "confiscate", "connoisseur", "conscientious", "conservative", "contagious",
        "conventional", "convey", "crucial", "crusade", "culminate", "Deceptive", "decipher", "decree",
        "deface", "defect", "deplore", "deploy", "desist", "desolate", "deter", "dialect",
        "dire", "discern", "disdain", "disgruntled", "dispatch", "disposition", "doctrine", "dub",
        "durable", "Eccentric", "elite", "embargo", "embark", "encroach", "endeavor", "enhance",
        "enigma", "epoch", "era", "eventful", "evolve", "exceptional", "excerpt", "excruciating",
        "exemplify", "exotic", "Facilitate", "fallacy", "fastidious", "feasible", "fend", "ferret",
        "flair", "flustered", "foreboding", "forfeit", "formidable", "fortify", "foster", "Gaunt",
        "gingerly", "glut", "grapple", "grope", "gullible", "Haggard", "haven", "heritage",
        "hindrance", "hover", "humane", "Imperative", "inaugurate", "incense", "indifferent", "infinite",
        "instill", "institute", "intervene", "intricate", "inventive", "inventory", "irascible", "Jurisdiction",
        "Languish", "legendary", "liberal", "loll", "lucrative", "luminous", "Memoir", "mercenary",
        "mien", "millennium", "minimize", "modify", "muse", "muster", "Onslaught", "ornate",
        "ovation", "overt", "Pang", "panorama", "perspective", "phenomenon", "pioneer", "pithy",
        "pivotal", "plausible", "plunder", "porous", "preposterous", "principal", "prodigy", "proficient",
        "profound", "pseudonym", "pungent", "Rankle", "rational", "rebuke", "reception", "recourse",
        "recur", "renounce", "renown", "revenue", "rubble", "rue", "Sage", "sedative",
        "serene", "servile", "shackle", "sleek", "spontaneous", "sporadic", "stamina", "stance",
        "staple", "stint", "strident", "sublime", "subside", "succumb", "surpass", "susceptible",
        "swelter", "Tedious", "teem", "theme", "tirade", "tract", "transition", "trepidation",
        "turbulent", "tycoon", "Ultimate", "ungainly", "Vice versa", "vie", "vilify", "voracious",
        "Wage", "wrangle",
    ],
}


def normalize_token(token: str) -> str:
    return re.sub(r"[^a-z]", "", token.lower())


def lemmatize(token: str) -> str:
    if token.endswith("ies") and len(token) > 4:
        return f"{token[:-3]}y"
    if token.endswith("ing") and len(token) > 5:
        return token[:-3]
    if token.endswith("ed") and len(token) > 4:
        return token[:-2]
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and len(token) > 3:
        return token[:-1]
    return token


def select_vocab_words(text: str, grade_level: int) -> List[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text)
    normalized_tokens = [normalize_token(t) for t in tokens]
    normalized_tokens = [t for t in normalized_tokens if t]
    token_counts = Counter(normalized_tokens)
    token_set = set(normalized_tokens)

    grade = min(8, max(3, int(grade_level)))
    selected: List[str] = []
    seen = set()

    for candidate in GRADE_VOCAB.get(grade, []):
        lemma = lemmatize(candidate)
        if candidate in token_set:
            choice = candidate
        elif lemma in token_set:
            choice = lemma
        else:
            continue

        if choice not in seen:
            selected.append(choice)
            seen.add(choice)
        if len(selected) >= 10:
            return selected

    # Fallback: chapter-present words by length/frequency to fill up to 10.
    fallback = sorted(
        (word for word, count in token_counts.items() if len(word) >= 5 and count >= 1),
        key=lambda w: (-token_counts[w], -len(w), w),
    )

    for word in fallback:
        lemma = lemmatize(word)
        candidate = lemma if lemma in token_set else word
        if candidate in seen:
            continue
        selected.append(candidate)
        seen.add(candidate)
        if len(selected) >= 10:
            break

    return selected


def main() -> None:
    import argparse
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to extracted chapter text")
    parser.add_argument("--grade", required=True, type=int)
    args = parser.parse_args()

    text = Path(args.source).read_text(encoding="utf-8", errors="ignore")
    words = select_vocab_words(text, args.grade)
    print(json.dumps({"words": words}))


if __name__ == "__main__":
    main()
