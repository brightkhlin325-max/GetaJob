const fs = require('fs');
let code = fs.readFileSync('src/pages/index.js', 'utf8');

// Fix Chunk 1: Duplicate Job Preferences Panel inside Scraper tab
const target1 = "勾選平台並點選「開始抓取職缺」，擴充功能會自動同步您的偏好並執行全站深度抓取！";
const startIdx1 = code.indexOf(target1);
if (startIdx1 !== -1) {
    const nextText = '                  {/* Job Preferences Panel */}';
    const errorIdx = code.indexOf(nextText, startIdx1);
    if (errorIdx !== -1 && errorIdx < startIdx1 + 500) {
        // Find the end of this erroneous block which ends at line 653: '              )}'
        const endText = '              )}\n';
        const endIdx1 = code.indexOf(endText, errorIdx);
        if (endIdx1 !== -1) {
            const before = code.substring(0, errorIdx);
            const after = code.substring(endIdx1 + endText.length);
            const replacement = '                    </div>\n                  </div>\n                </div>\n              </div>\n            </div>\n          )}\n';
            code = before + replacement + after;
        }
    }
}

// Fix Chunk 2: Closing tags for dashboard and main layout
const target2 = `              )}
            </div>

          </div>
        )}
      </div>

      
                </>
              )}
            </div>
          </div>`;

const rep2 = `              )}
            </div>
          </>
        )}
      </div>
    </div>
  )}
</div>`;

code = code.replace(target2, rep2);

fs.writeFileSync('src/pages/index.js', code);
console.log('Fixes applied.');
