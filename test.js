const TP = require("./KATranslationProcessor.js")

function assertSame(engl) {
    if(TP.tryAutotranslate(engl) != engl) {
        console.error(`Failed to translate ${engl}`)
    }
}

assertSame("$a$")
assertSame(" $b$ ")
assertSame("$c$\\n")
assertSame("$d$\\n\\n$db$ \\n")
assertSame("web+graphie://ka-perseus-graphie.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273")
assertSame("https://ka-perseus-images.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273.svg")
assertSame("https://ka-perseus-images.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273.png")
assertSame("$\\\\blue{A_c} = \\\\pi (\\\\pink{10})^2$\\n\\n $\\\\blue{A_c} = 100\\\\pi$\\n\\n ![](web+graphie://ka-perseus-graphie.s3.amazonaws.com/b8ca00d508c9e7b593c669977fdde31570195273)")