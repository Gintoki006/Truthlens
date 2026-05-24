import spacy
nlp = spacy.load('en_core_web_sm')
doc = nlp('Chandrayaan-3 successfully landed on the Moon's south pole in August 2023')
print([(e.text, e.label_) for e in doc.ents])
print([(t.text, t.pos_) for t in doc])
