from pathlib import Path
import urllib.request, json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
FONTS = ROOT / 'fonts'
FONTS.mkdir(exist_ok=True)
families = ['nanummyeongjo','gowunbatang','notoserifkr','librebaskerville','ebgaramond','crimsonpro']
paths = {}
for family in families:
    req = urllib.request.Request(f'https://api.github.com/repos/google/fonts/contents/ofl/{family}', headers={'User-Agent':'Font-specimen'})
    entries = json.load(urllib.request.urlopen(req))
    fonts = [e for e in entries if e['name'].endswith('.ttf') and 'Italic' not in e['name']]
    chosen = next((e for e in fonts if 'Regular' in e['name']), fonts[0])
    target = FONTS / chosen['name']
    if not target.exists():
        target.write_bytes(urllib.request.urlopen(chosen['download_url']).read())
    paths[family] = target
    (FONTS / (family + '-OFL.txt')).write_bytes(urllib.request.urlopen(next(e['download_url'] for e in entries if e['name']=='OFL.txt')).read())

def font(family, size, weight=400):
    f = ImageFont.truetype(str(paths[family]), size)
    try:
        axes=f.get_variation_axes()
        f.set_variation_by_axes([weight if a['name']==b'Weight' else a['default'] for a in axes])
    except OSError:
        pass
    return f

INK='#2c2c2b'; MUTED='#8a8782'; LINE='#e8e6e2'
def board(kind, rows):
    im=Image.new('RGB',(1500,1570),'white'); d=ImageDraw.Draw(im)
    d.text((100,58),kind,font=font('librebaskerville',25),fill=MUTED)
    d.text((100,112),'A quiet space for words.',font=font('librebaskerville',43),fill=INK)
    d.text((100,187),'동일한 문장 · 동일한 크기 · Regular 400',font=font('gowunbatang',25),fill=MUTED)
    for i,(family,name,desc) in enumerate(rows):
        y=270+i*420
        d.line((100,y,1400,y),fill=LINE,width=2)
        d.text((100,y+28),f'0{i+1}  /  {name}',font=font('gowunbatang',29),fill=MUTED)
        if kind.startswith('KOREAN'):
            d.text((100,y+95),'나 자신에게 진실하기.',font=font(family,54),fill=INK)
            lines=['자신의 존재 이유를 찾는 과정은 아마도 인생의 가장 큰 기쁨 중 하나라고 생각합니다.', '제가 가진 가장 소중한 재산인 시간을 어디에 쓰고 있는지 솔직하게 남기려고 합니다.']
            for j,line in enumerate(lines): d.text((100,y+198+j*58),line,font=font(family,30),fill=INK)
        else:
            d.text((100,y+95),'Donghyeon Jeong',font=font(family,63),fill=INK)
            for j,line in enumerate(['Be true to yourself. Love what you do.', 'Finding your purpose is one of the great joys in life.']):
                d.text((100,y+202+j*54),line,font=font(family,34),fill=INK)
        d.text((100,y+335),desc,font=font('gowunbatang',25),fill=MUTED)
    d.text((100,1520),'Actual font files / White background / No generated lettering',font=font('librebaskerville',18),fill=MUTED)
    im.save(ROOT/('korean-fonts.png' if kind.startswith('KOREAN') else 'english-fonts.png'))

board('KOREAN / 3 TYPEFACES',[
 ('nanummyeongjo','나눔명조 · Nanum Myeongjo','문학적 · 섬세한 획 · 오래된 책의 인상'),
 ('gowunbatang','고운바탕 · Gowun Batang','부드러움 · 손의 온기 · 편안한 에세이'),
 ('notoserifkr','본명조 · Noto Serif KR','단정함 · 균형감 · 긴 글을 위한 안정감')])
board('ENGLISH / 3 TYPEFACES',[
 ('librebaskerville','Libre Baskerville','담백하고 또렷한 인쇄물 · 현재 분위기와 연결하기 좋은 선택'),
 ('ebgaramond','EB Garamond','고전 문학 · 유려한 글자 · 가장 오래된 책 같은 인상'),
 ('crimsonpro','Crimson Pro','절제된 세리프 · 부드러운 리듬 · 현대적인 문예지의 인상')])
print('Rendered:', ROOT/'korean-fonts.png', ROOT/'english-fonts.png')
