const TP = require("./KATranslationProcessor.js")

function assertSame(engl) {
    if(TP.tryAutotranslate(engl) != engl) {
        console.error(`Failed to translate ${engl}`)
    }
}

function assertNotTranslated(engl) {
    let res = TP.tryAutotranslate(engl)
    if(res != null) {
        console.error(`${engl} was translated to ${res} (should not be translated)`)
    }
}


assertSame("$a$")
assertSame(" $b$ ")
assertSame("$c$\\n")
assertSame("$d$\\n\\n$db$ \\n")

assertNotTranslated("$d\\\\text{foo}$")
assertSame("$d\\\\text{ cm}$")
assertSame("$d\\\\text{ g}$")
assertSame("$d\\\\text{ m}$")

assertSame("web+graphie://ka-perseus-graphie.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273")
assertSame("https://ka-perseus-images.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273.svg")
assertSame("![](https://ka-perseus-images.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273.svg)")
assertSame("https://ka-perseus-images.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273.png")
assertSame("$\\\\blue{A_c} = \\\\pi (\\\\pink{10})^2$\\n\\n $\\\\blue{A_c} = 100\\\\pi$\\n\\n ![](web+graphie://ka-perseus-graphie.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273)")