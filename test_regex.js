
const tagRegex = /^(\s*\([^)]+\)\s*)+/;

const tests = [
    "(Tag) Term",
    "(Tag)Term",
    "(Tag)  Term",
    "(Tag1) (Tag2) Term",
    "(Tag with spaces) Term",
    " (Tag) Term",
    "(Tag) - Term"
];

tests.forEach(t => {
    const match = t.match(tagRegex);
    if (match) {
        const clean = t.replace(tagRegex, '').trim();
        console.log(`'${t}' -> Match: '${match[0]}', Clean: '${clean}'`);
    } else {
        console.log(`'${t}' -> No match`);
    }
});
