const puppeteer = require('puppeteer');
const path = require('path');
const url = require('url');
const fs = require('fs');

const myurl = url.format({
    protocol: 'file',
    slashes: true,
    pathname: path.join(__dirname, 'files/van-gogh-paintings.html')
})

async function run(url, uniqueId = 0) {
    const browser = await puppeteer.launch({
        //dumpio: true, log console output to terminal
        //userDataDir: './data', Useful if you want cookies to continue,
        // i.e. no need to accept everytime
        headless: true,
        defaultViewport:
        {
            width:1920,
            height:1080
        }
    });
    const page = await browser.newPage();
    await page.goto(url);

    // Click I agree to google consent form, to allow for better screenshots
    let [button] = await page.$x("//button[contains(., 'I agree')]");
    if (button) {
        await button.click();
    }

    // Click the right button along the carousel to ensure pictures load
    for(let i=0; i<0; ++i) {
        [button] = await page.$x("(//g-scrolling-carousel//g-right-button)[1]");
        console.log(button);
        if (button) {
            await button.click();
        }
    }

    const json = await page.evaluate(() => {
        /** Go for the slow but reliable way of grabbing the Title,
         *  by comparing parent #extabar innerText to carousel innerText.
         *  IF only live google searches needed to be used, (and not old paintings.html),
         *  could grab carousel and check previous sibling innerText.
         */

        // Found through Selector Gadget, could also query for g-scrolling-carousel and work from there
        const extabar = document.querySelector('#extabar');
        const extabarInnerText = extabar.innerText;
        const carousel = extabar.querySelector('.DAVP1');
        const carouselInnerText = carousel.innerText;

        const extabarSplit = extabarInnerText.split('\n');
        const carouselFirstItem = carouselInnerText.substr(0, carouselInnerText.indexOf('\n'));

        const index = extabarSplit.findIndex(item => item === carouselFirstItem) - 1;

        function isCapitalLetter(char) {
            const charCode = char.charCodeAt(0);
            return charCode > 64 && charCode < 91;
        }
        const titleStr = extabarSplit[index];
        const firstCapital = Object.keys(titleStr).reverse().find( x => isCapitalLetter(titleStr[x]));

        const title = titleStr.substr(firstCapital);

        /** Define useful functions for getting props on an HTMLElement
         *  based on depth first searching the element.
         */
        function getItemProperty(property) {
            return function getProp(item) {
                const childElementCount = item.childElementCount;
                if(!item[property]) {
                    if(childElementCount === 0) {
                        return "";
                    } else {
                        for(let i=0; i<childElementCount; ++i) {
                            const childLabel = getProp(item.children[i]);
                            if(childLabel) {
                                return childLabel;
                            }
                        }
                    }

                } else {
                    return item[property];
                }

                return "";
            }
        }

        function getAriaLabel(item) {
            return getItemProperty('ariaLabel')(item);
        }

        function getHref(item) {
            return getItemProperty('href')(item);
        }

        // You can use the title as a substitute for innerText,
        // as innerText might not be populated but .title & ariaLabel will
        function getTitle(item) {
            return getItemProperty('title')(item);
        }

        function getSrc(item) {
            return getItemProperty('src')(item);
        }

        /** Now for each item generate the obj to store in JSON format
         *
         */
        const scrapedData = {} ;
        scrapedData[title] = [];

        const items = carousel.children;

        for (const item of items) {
            const label = getAriaLabel(item);

            if(!label) {
                continue;
            }

            const obj = {};

            obj["name"] = label;

            const itemTitle = getTitle(item);

            if(itemTitle.length > label.length) {
                const details = itemTitle.substring(label.length + 2, itemTitle.length - 1);
                obj["extensions"] = details.split(', ');
            }

            const link = getHref(item);
            if(link) {
                obj["link"] = link;
            }

            obj["image"] = item.querySelector('img')?.src || 'null';
            //obj["image"] = getSrc(item) || 'null';

            scrapedData[title].push(obj);
        }

        // Add spacing to the returned JSON
        return JSON.stringify(scrapedData, null, 2);
    });

    await page.screenshot({path: 'out/screenshot' + uniqueId + '.png'});
    browser.close();
    fs.writeFileSync('out/data' + uniqueId + '.json', json);
}

run(myurl);
run('https://www.google.com/search?q=lil+peep+albums&oq=lil+peep&aqs=chrome.0.69i59j46i433i512j0i433i512l3j0i512l4.           1009j0j7&sourceid=chrome&ie=UTF-8', 1);
run('https://www.google.com/search?q=trump+books', 2);
run('https://www.google.com/search?q=van+gogh+paintings', 3);