import type { z } from 'zod';
import type { sourceSchema } from './schema';

/**
 * Trusted sources only (SPEC 6.7 B): official bodies, official documentation and
 * peer-reviewed research. No unverified web content. `checked` = when it was last looked at.
 */
export const SOURCES: z.input<typeof sourceSchema>[] = [
  // ---- Careers and skills ----
  {
    id: 'onet',
    title: 'O*NET OnLine (occupations, skills, interest profiles)',
    publisher: 'U.S. Department of Labor, Employment and Training Administration',
    url: 'https://www.onetonline.org/',
    license: 'CC BY 4.0',
    checked: '2026-11',
  },
  {
    id: 'onet-interest-profiler',
    title: 'O*NET Interest Profiler (RIASEC)',
    publisher: 'U.S. Department of Labor, Employment and Training Administration',
    url: 'https://www.mynextmove.org/explore/ip',
    license: 'CC BY 4.0',
    checked: '2026-11',
  },
  {
    id: 'esco',
    title: 'ESCO — European Skills, Competences, Qualifications and Occupations',
    publisher: 'European Commission',
    url: 'https://esco.ec.europa.eu/en/classification/occupation_main',
    checked: '2026-11',
  },
  // ---- Germany / studying abroad ----
  {
    id: 'daad',
    title: 'DAAD — Study in Germany (international programmes, application)',
    publisher: 'German Academic Exchange Service (DAAD)',
    url: 'https://www.daad.de/en/',
    checked: '2026-11',
  },
  {
    id: 'aps-india',
    title: 'Academic Evaluation Centre (APS) India',
    publisher: 'APS India, German Embassy New Delhi',
    url: 'https://www.aps-india.de/',
    checked: '2026-11',
  },
  {
    id: 'uni-assist',
    title: 'uni-assist (application service for international students)',
    publisher: 'uni-assist e.V.',
    url: 'https://www.uni-assist.de/en/',
    checked: '2026-11',
  },
  {
    id: 'ielts',
    title: 'IELTS — official test information',
    publisher: 'IELTS (British Council, IDP, Cambridge)',
    url: 'https://ielts.org/',
    checked: '2026-11',
  },
  {
    id: 'gre',
    title: 'GRE General Test — official information',
    publisher: 'ETS',
    url: 'https://www.ets.org/gre.html',
    checked: '2026-11',
  },
  {
    id: 'german-missions-india',
    title: 'German Missions in India — student visa',
    publisher: 'Federal Foreign Office, Germany',
    url: 'https://india.diplo.de/',
    checked: '2026-11',
  },
  // ---- Official learning documentation ----
  {
    id: 'ros2-docs',
    title: 'ROS 2 Documentation',
    publisher: 'Open Robotics',
    url: 'https://docs.ros.org/en/rolling/',
    checked: '2026-11',
  },
  {
    id: 'unreal-docs',
    title: 'Unreal Engine Documentation',
    publisher: 'Epic Games',
    url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine',
    checked: '2026-11',
  },
  {
    id: 'isocpp',
    title: 'Get Started with C++',
    publisher: 'Standard C++ Foundation',
    url: 'https://isocpp.org/get-started',
    checked: '2026-11',
  },
  {
    id: 'cppreference',
    title: 'cppreference.com (C++ reference)',
    publisher: 'cppreference.com',
    url: 'https://en.cppreference.com/',
    checked: '2026-11',
  },
  {
    id: 'python-docs',
    title: 'The Python Tutorial',
    publisher: 'Python Software Foundation',
    url: 'https://docs.python.org/3/tutorial/',
    checked: '2026-11',
  },
  {
    id: 'pytorch-docs',
    title: 'PyTorch Tutorials',
    publisher: 'PyTorch Foundation',
    url: 'https://pytorch.org/tutorials/',
    checked: '2026-11',
  },
  {
    id: 'google-mlcc',
    title: 'Machine Learning Crash Course',
    publisher: 'Google for Developers',
    url: 'https://developers.google.com/machine-learning/crash-course',
    checked: '2026-11',
  },
  {
    id: 'opencv-docs',
    title: 'OpenCV Documentation',
    publisher: 'OpenCV',
    url: 'https://docs.opencv.org/',
    checked: '2026-11',
  },
  {
    id: 'gazebo-docs',
    title: 'Gazebo Documentation',
    publisher: 'Open Robotics',
    url: 'https://gazebosim.org/docs',
    checked: '2026-11',
  },
  {
    id: 'isaac-sim',
    title: 'NVIDIA Isaac Sim',
    publisher: 'NVIDIA',
    url: 'https://developer.nvidia.com/isaac/sim',
    checked: '2026-11',
  },
  {
    id: 'mit-ocw-1806',
    title: 'MIT 18.06 Linear Algebra (OpenCourseWare)',
    publisher: 'Massachusetts Institute of Technology',
    url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
    checked: '2026-11',
  },
  {
    id: 'modern-robotics',
    title: 'Modern Robotics: Mechanics, Planning, and Control (Lynch & Park, free book + videos)',
    publisher: 'Northwestern University',
    url: 'https://hades.mech.northwestern.edu/index.php/Modern_Robotics',
    checked: '2026-11',
  },
  {
    id: 'underactuated',
    title: 'Underactuated Robotics (course notes)',
    publisher: 'Massachusetts Institute of Technology (R. Tedrake)',
    url: 'https://underactuated.mit.edu/',
    checked: '2026-11',
  },
  {
    id: 'arduino-docs',
    title: 'Arduino Documentation',
    publisher: 'Arduino',
    url: 'https://docs.arduino.cc/',
    checked: '2026-11',
  },
  {
    id: 'freertos',
    title: 'FreeRTOS Documentation',
    publisher: 'Amazon Web Services (FreeRTOS)',
    url: 'https://www.freertos.org/',
    checked: '2026-11',
  },
  {
    id: 'blender-manual',
    title: 'Blender Manual',
    publisher: 'Blender Foundation',
    url: 'https://docs.blender.org/manual/en/latest/',
    checked: '2026-11',
  },
  {
    id: 'git-docs',
    title: 'Pro Git (official Git book)',
    publisher: 'git-scm.com',
    url: 'https://git-scm.com/book/en/v2',
    checked: '2026-11',
  },
  // ---- Study science (peer-reviewed) ----
  {
    id: 'dunlosky-2013',
    title:
      'Dunlosky et al. (2013) Improving Students’ Learning With Effective Learning Techniques. Psychological Science in the Public Interest 14(1)',
    publisher: 'Association for Psychological Science',
    url: 'https://doi.org/10.1177/1529100612453266',
    checked: '2026-11',
  },
  {
    id: 'cepeda-2006',
    title:
      'Cepeda et al. (2006) Distributed practice in verbal recall tasks: a review and quantitative synthesis. Psychological Bulletin 132(3)',
    publisher: 'American Psychological Association',
    url: 'https://doi.org/10.1037/0033-2909.132.3.354',
    checked: '2026-11',
  },
  {
    id: 'lally-2010',
    title:
      'Lally et al. (2010) How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology 40(6)',
    publisher: 'Wiley',
    url: 'https://doi.org/10.1002/ejsp.674',
    checked: '2026-11',
  },
  {
    id: 'ophir-2009',
    title: 'Ophir, Nass & Wagner (2009) Cognitive control in media multitaskers. PNAS 106(37)',
    publisher: 'Proceedings of the National Academy of Sciences',
    url: 'https://doi.org/10.1073/pnas.0903620106',
    checked: '2026-11',
  },
  {
    id: 'ward-2017',
    title:
      'Ward et al. (2017) Brain Drain: The Mere Presence of One’s Own Smartphone Reduces Available Cognitive Capacity. J. Assoc. Consumer Research 2(2)',
    publisher: 'University of Chicago Press',
    url: 'https://doi.org/10.1086/691462',
    checked: '2026-11',
  },
  // ---- Health ----
  {
    id: 'who-activity-2020',
    title: 'WHO guidelines on physical activity and sedentary behaviour (2020)',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/publications/i/item/9789240015128',
    checked: '2026-11',
  },
  {
    id: 'who-activity-facts',
    title: 'Physical activity — fact sheet',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
    checked: '2026-11',
  },
  {
    id: 'who-diet-facts',
    title: 'Healthy diet — fact sheet',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    checked: '2026-11',
  },
  {
    id: 'who-mental-facts',
    title: 'Mental health: strengthening our response — fact sheet',
    publisher: 'World Health Organization',
    url: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
    checked: '2026-11',
  },
  {
    id: 'icmr-nin-2024',
    title: 'Dietary Guidelines for Indians (2024)',
    publisher: 'ICMR – National Institute of Nutrition, Hyderabad',
    url: 'https://www.nin.res.in/',
    checked: '2026-11',
  },
  {
    id: 'aasm-sleep-2015',
    title:
      'Recommended Amount of Sleep for a Healthy Adult: A Joint Consensus Statement of the AASM and Sleep Research Society (2015)',
    publisher: 'American Academy of Sleep Medicine / Sleep Research Society',
    url: 'https://doi.org/10.5665/sleep.4716',
    checked: '2026-11',
  },
  {
    id: 'tele-manas',
    title: 'Tele-MANAS — National Tele Mental Health Programme',
    publisher: 'Ministry of Health and Family Welfare, Government of India',
    url: 'https://telemanas.mohfw.gov.in/',
    checked: '2026-11',
  },
];

/** Shown wherever O*NET data is used (CC BY 4.0 requires attribution). */
export const ONET_ATTRIBUTION =
  'Career, skill and interest data in part from O*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. ASCEND has modified all or some of this information; USDOL/ETA has not approved, endorsed or tested these modifications.';
