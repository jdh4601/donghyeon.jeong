"""Import the connector export without changing the Notion source."""
import json,re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'.content-source.json').read_text())
media=json.loads((root/'src/content/media-manifest.json').read_text())
hero_path='/media/'+next(key for key,value in media.items() if value['file']=='monk-by-the-sea.webp')
note_path='/media/'+next(key for key,value in media.items() if value['file']=='career-note.webp')
def content(page): return page['text'].split('<content>\n',1)[1].split('\n</content>',1)[0]
def clean(text):
    text=re.sub(r'<image source="([^"]+)"\s*>([\s\S]*?)</image>',lambda m:'\n\n!['+re.sub('<[^>]+>','',m[2]).strip()+']('+('/images/monk-by-the-sea.jpg' if '159f8203' in m[1] else '/images/career-note.jpg')+')\n\n',text)
    text=re.sub(r'<image source="([^"]+)"\s*/>',lambda m:'\n\n![글에 첨부된 이미지]('+('/images/career-note.jpg' if '3224d123' in m[1] else '/images/monk-by-the-sea.jpg')+')\n\n',text)
    text=re.sub(r'<video source="([^"]+)"\s*/>',r'\n\n[영상 보기](\1)\n\n',text)
    text=re.sub(r'<embed source="([^"]+)"\s*/>',r'\n\n[관련 페이지](\1)\n\n',text)
    text=re.sub(r'<span[^>]*>([\s\S]*?)</span>',r'\1',text)
    text=re.sub(r'</?p\s*/?>','\n\n',text)
    text=text.replace('<b>','**').replace('</b>','**').replace('<i>','*').replace('</i>','*')
    text=re.sub(r'<br\s*/?>','  \n',text)
    text=text.replace('/images/monk-by-the-sea.jpg',hero_path).replace('/images/career-note.jpg',note_path)
    return re.sub(r'\n{3,}','\n\n',text).strip()

home=content(raw['home'])
caption=re.sub(r'<[^>]+>','',re.search(r'<image[^>]*>([\s\S]*?)</image>',home).group(1)).strip().replace('\\~','~')
parts=re.split(r'^###\s+.*$',home,flags=re.M)
about=parts[2].split(':github:')[0].strip()
manifesto=[]
for item in re.findall(r'\d\. <i>(.*?)</i>',parts[3],re.S):
    en,ko=re.split(r'<br\s*/>',item,maxsplit=1)
    manifesto.append({'en':en.strip(),'ko':ko.strip()})
articles=[]
for item in raw['articles']:
    props=json.loads(item['text'].split('<properties>\n')[1].split('\n</properties>')[0])
    articles.append({'id':item['id'],'slug':item['id'],'title':item['title'],'date':props.get('date:Date:start'),'markdown':clean(content(item)),'published':True})
snapshot={'syncedAt':raw['home']['page_last_edited_at'],'source':'notion-connector-snapshot','home':{'intro':clean(parts[1]),'about':clean(about),'manifesto':manifesto,'image':hero_path,'caption':caption},'articles':articles}
(root/'src/content/snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2))
print('Imported',len(articles),'articles and',len(manifesto),'principles')
