import{test}from'node:test';import assert from'node:assert/strict';import{runRubricChecks}from'./rubric-checks';import{fingerprint,imageSimilarity}from'./image-signature';import{descriptionSimilarity,nameSimilarity}from'./detection';
for(const result of runRubricChecks())test(result.name,()=>assert.equal(result.passed,true));
test('different RGB means distinguish flat images with identical difference hashes',()=>{const red=Uint8ClampedArray.from({length:288},(_,i)=>i%4===0||i%4===3?255:0),blue=Uint8ClampedArray.from({length:288},(_,i)=>i%4===2||i%4===3?255:0);assert.ok(imageSimilarity(fingerprint(red),fingerprint(blue))!<.85)});
test('missing or mismatched image signatures are unavailable',()=>assert.equal(imageSimilarity(undefined,undefined),null));
test('token match detects a brand with descriptive app suffix',()=>assert.equal(nameSimilarity('Notion','Notion: Notes, Tasks, AI').code,'BRAND_TOKEN_MATCH'));
test('description comparison tolerates word order',()=>assert.equal(descriptionSimilarity('secure payments for business','business for secure payments'),1));
