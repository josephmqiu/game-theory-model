State a factual claim derived from one or more observations, representing one interpretive step beyond raw evidence.
Inputs: `statement` (required — what you're claiming), `based_on` (required array of observation IDs), `confidence` (0–1, default 0.7).
All observation IDs in `based_on` must reference observations you have already created; claims built on nonexistent observations will fail referential integrity checks.
Claims interpret observations rather than restate them — "The 3.2% GDP decline signals recession risk" is a claim; "GDP fell 3.2%" is the observation it rests on.
