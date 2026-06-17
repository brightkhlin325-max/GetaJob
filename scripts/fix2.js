const fs = require('fs');
let lines = fs.readFileSync('src/pages/index.js', 'utf8').split(/\r?\n/);
let startIndex = lines.findIndex(l => l.includes('</>'));
if (startIndex !== -1) {
    // startIndex is the line with </>. That is line 903 (index 902) in my previous dump.
    // The sequence starts at index 896 (line 897) which is after `            </div>`
    // Let's find `            </div>` just before </>
    let divIdx = startIndex - 1;
    while (divIdx > 0 && !lines[divIdx].includes('            </div>')) {
        divIdx--;
    }
    // divIdx is line 896. We replace from divIdx + 1
    lines.splice(divIdx + 1, 15,
        "          </>",
        "        )}",
        "      </div>",
        "    </div>",
        "  )}",
        "</div>"
    );
    // write back
    fs.writeFileSync('src/pages/index.js', lines.join('\n'));
    console.log('Fixed tags');
} else {
    console.log('Not found');
}
