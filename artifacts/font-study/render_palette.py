from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).parent
K=ROOT/'fonts/GowunBatang-Regular.ttf'
E=next((ROOT/'fonts').glob('EBGaramond*.ttf'))
def k(s):return ImageFont.truetype(str(K),s)
def e(s):
 f=ImageFont.truetype(str(E),s)
 try:f.set_variation_by_axes([450])
 except OSError:pass
 return f

W,H=1600,1690
im=Image.new('RGB',(W,H),'#FFFFFF');d=ImageDraw.Draw(im)
d.text((80,50),'COLOR STUDY / Donghyeon Jeong',font=e(30),fill='#6B6B6B')
d.text((80,104),'색은 줄이고, 그림과 글을 남기기.',font=k(43),fill='#000000')
d.text((80,177),'본문은 모두 검은색 · 배경과 회색의 온도만 비교',font=k(24),fill='#6B6B6B')
rows=[
 ('01','백색과 먹색','추천 · 현재 방향에 가장 가까운, 깨끗하고 절제된 조합', ['#FFFFFF','#000000','#6B6B6B','#E5E5E5','#F8F7F5']),
 ('02','옅은 종이색','조금 더 따뜻한 인상 · 아이보리는 아주 약하게', ['#FAF9F6','#000000','#756F66','#E5E1D9','#F1EFEA']),
 ('03','차가운 백색','차분한 갤러리의 인상 · 아주 미세한 청회색', ['#F7F8F8','#000000','#697174','#DFE3E4','#EDF0F0'])]
labels=['바탕','본문','보조 글씨','구분선','인용·박스 바탕']
for index,(num,title,desc,colors) in enumerate(rows):
 y=260+index*460
 bg,ink,muted,line,surface=colors
 d.line((80,y,1520,y),fill='#E5E5E5',width=2)
 d.text((80,y+26),f'{num}  {title}',font=k(31),fill='#000000')
 d.text((80,y+77),desc,font=k(21),fill='#6B6B6B')
 for j,color in enumerate(colors):
  x=80+j*132
  d.rounded_rectangle((x,y+135,x+112,y+238),radius=3,fill=color,outline='#DDDDDD',width=1)
  d.text((x,y+252),labels[j],font=k(17),fill='#6B6B6B')
  d.text((x,y+283),color,font=e(22),fill='#000000')
 x=820;right=1520
 d.rectangle((x,y+28,right,y+413),fill=bg,outline=line,width=1)
 nav='동현정     About     Manifesto     Thoughts'
 d.text((x+67,y+62),nav,font=k(17),fill=muted)
 d.text((x+55,y+117),'Intro',font=e(35),fill=ink)
 d.text((x+55,y+170),'나 자신에게 진실하기.',font=k(30),fill=ink)
 d.text((x+55,y+220),'가장 소중한 시간을 어디에 쓰고 있는지,',font=k(22),fill=ink)
 d.text((x+55,y+259),'그 과정을 솔직하게 남기려고 합니다.',font=k(22),fill=ink)
 d.rectangle((x+55,y+315,right-55,y+376),fill=surface)
 d.line((x+70,y+326,x+70,y+365),fill=ink,width=2)
 d.text((x+88,y+330),'Be true to yourself.',font=e(27),fill=ink)
d.text((80,1650),'한 가지 팔레트를 사이트 전체에 적용합니다. 그림 속 색은 별도의 UI 강조색으로 반복하지 않습니다.',font=k(21),fill='#6B6B6B')
im.save(ROOT/'color-palettes.png')
print(ROOT/'color-palettes.png')
