// src/utils/exerciseImages.ts

/* -------------------- CATEGORY IMAGES -------------------- */

export function categoryImageFor(name: string): string | null {
    const n = name.toLowerCase();

    if (n.includes('chest')) return IMG.chest;
    if (n.includes('back')) return IMG.back;
    if (n.includes('leg')) return IMG.legs;
    if (n.includes('shoulder')) return IMG.shoulders;
    if (n.includes('calves')) return IMG.calves;
    if (n.includes('arm') || n.includes('bicep') || n.includes('tricep')) return IMG.arms;
    if (n.includes('abs') || n.includes('core')) return IMG.abs;
    if (n.includes('cardio')) return IMG.cardio;
    if (n.includes('full')) return IMG.fullbody;

    return null;
}

/* -------------------- EQUIPMENT IMAGES -------------------- */

export function equipmentImageFor(name: string): string | null {
    const n = name.toLowerCase();

    if (n === 'all') return IMG.all;
    if (n.includes('barbell')) return IMG.barbell;
    if (n.includes('dumbbell')) return IMG.dumbbell;
    if (n.includes('kettlebell')) return IMG.kettlebell;
    if (n.includes('band')) return IMG.band;
    if (n.includes('gym mat')) return IMG.gymmat;
    if (n.includes('bench')) return IMG.bench;
    if (n.includes('cable')) return IMG.cable;
    if (n.includes('none')) return IMG.none;
    if (n.includes('pull-up bar')) return IMG.pullup_bar;
    if (n.includes('resistance band')) return IMG.resistance_band;
    if (n.includes('swiss ball')) return IMG.swiss_ball;
    if (n.includes('sz-bar')) return IMG.sz_bar;

    return null;
}

/* -------------------- IMAGE REGISTRY -------------------- */

const IMG = {
    chest:
        'https://media.istockphoto.com/id/924491214/photo/muscular-man-working-out-in-gym-strong-male-torso-abs.jpg?s=612x612&w=0&k=20&c=LhJqc4tDLeUu6vNSGKuXoZTJFV9fTwCbytqvI7y1hxk=',
    back:
        'https://media.istockphoto.com/id/610576810/photo/athlete-muscular-fitness-male-model-pulling-up-on-horizontal-bar.jpg?s=612x612&w=0&k=20&c=k01ldxDTJQK88DwlBpp4T8tEB0XSBHdhcervDUvJvjU=',
    legs:
        'https://img.freepik.com/free-photo/athletic-blonde-woman-sportswear-doing-exercise-legs-press-machine-gym_613910-21244.jpg?semt=ais_hybrid&w=740&q=80',
    shoulders:
        'https://media.istockphoto.com/id/1461372152/photo/young-woman-training-with-dumbbells-at-the-gym.jpg?s=612x612&w=0&k=20&c=2C3R7qK8ZpVgJnWZKIjgYx2ZRkcQwMVozWzxZfg8J_w=',
    arms:
        'https://static.vecteezy.com/system/resources/thumbnails/060/377/287/small/muscular-arm-flexing-with-visible-veins-and-sweat-showcasing-strength-and-fitness-in-gym-environment-photo.jpg',
    abs:
        'https://www.shutterstock.com/image-photo/close-athletic-woman-toned-abs-600nw-2648768461.jpg',
    cardio:
        'https://media.istockphoto.com/id/1132086660/photo/side-view-of-beautiful-muscular-woman-running-on-treadmill.jpg?s=612x612&w=0&k=20&c=5Vq_BJjG7sbIyKIP-Adu0pChReDXm0dC7BVPvto2M0I=',
    fullbody:
        'https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=600&q=70',
    calves:
        'https://hips.hearstapps.com/hmg-prod/images/trained-mans-legs-with-muscular-calves-in-sneakers-royalty-free-image-1709850608.jpg?crop=0.559xw:1.00xh;0.221xw,0&resize=1200:*',

    all:
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGhlJTIwZ3ltfGVufDB8fDB8fHww',
    barbell:
        'https://cdn.shopify.com/s/files/1/0133/8576/0826/files/barbell-training.jpg',
    dumbbell:
        'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=70',
    kettlebell:
        'https://assets.roguefitness.com/f_auto,q_auto,c_limit,w_521,b_rgb:f8f8f8/catalog/Conditioning/Strength%20Equipment/Kettlebells/IP0670/IP0670-H_j6gkfw.png',
    band:
        'https://images.unsplash.com/photo-1599058917212-d750089bc07f?auto=format&fit=crop&w=600&q=70',
    gymmat:
        'https://www.trxtraining.com/cdn/shop/articles/trx-exercise-mat-warm-up_794da7aa-f252-44ca-b022-0511c81c0265.jpg?v=1759914590',
    bench:
        'https://www.bestusedgymequipment.com/wp-content/uploads/2025/06/3-min-1.jpg',
    cable:
        'https://images.unsplash.com/photo-1556817411-31ae72fa3ea0?auto=format&fit=crop&w=600&q=70',
    none:
        'https://www.verywellfit.com/thmb/O6Cn_kBvb1hZAn0jl2GaerNUaoQ=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/GettyImages-1194421817-98e975827ad14c588646ae40470bf488.jpg',
    pullup_bar:
        'https://www.gornation.com/cdn/shop/articles/Entdecke_wie_Push_Up_Bars_dein_Calisthenics-Training_verbessern._Lerne_die_besten_Uebungen_Vorteile_und_Tipps_zur_effektiven_Nutzung._17_6ece19ea-50b7-4d4c-86ae-cfde571e8d15.png?v=1758631760',
    resistance_band:
        'https://cdn.centr.com/content/26000/25810/images/landscape32medium2x-5-fabric-band-exercises-to-target-your-glutes-header-ingrid---portraits-with-products-2595-32.jpg',
    swiss_ball:
        'https://www.lacertosus.com/modules/pcomblocks/views/images/rowcolumns/swiss-ballgym-ball-55-cm.jpg',
        sz_bar:
        'https://imagely.mirafit.co.uk/wp/wp-content/uploads/2019/08/fitness-expert-doing-bicep-curls-with-an-ez-cutl-bar.jpg',
};
