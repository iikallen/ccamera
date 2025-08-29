import Link from 'next/link';
import Image from 'next/image';
import SurveillancePreview from '@/app/(public)/(home)/SurveillancePreview';
import FeatureCard from '@/app/(public)/(home)/FeatureCard';
import TestimonialCard from '@/app/(public)/(home)/TestimonialCard';
import { FaShieldAlt, FaVideo, FaCloud, FaMobileAlt, FaChartLine, FaPlug } from 'react-icons/fa';

export const metadata = {
  title: 'Система видеонаблюдения Hikvision | Главная страница',
  description: 'Мощная система видеонаблюдения с поддержкой камер Hikvision. Прямые трансляции, архив записей, аналитика и управление с любого устройства.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        
      {/* Шапка сайта */}

      {/* Hero секция */}
      <section className="relative py-20 md:py-32 bg-gradient-to-r from-blue-900 to-indigo-900 text-white overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Умное видеонаблюдение <br />
                <span className="text-blue-400">для вашей безопасности</span>
              </h1>
              <p className="text-xl mb-8 text-blue-200 max-w-lg">
                Полный контроль над вашим пространством с помощью современных технологий видеонаблюдения
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <SurveillancePreview />
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-blue-900 to-transparent"></div>
      </section>

      {/* Преимущества */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Почему выбирают нашу систему
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Современные технологии для вашей безопасности и комфорта
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<FaShieldAlt className="text-blue-500 text-3xl" />}
              title="Надежная защита"
              description="Шифрование данных и многоуровневая система безопасности для вашего спокойствия"
            />
            <FeatureCard 
              icon={<FaVideo className="text-blue-500 text-3xl" />}
              title="Высокое качество видео"
              description="Трансляции в 4K разрешении с поддержкой HDR и ночного видения"
            />
            <FeatureCard 
              icon={<FaCloud className="text-blue-500 text-3xl" />}
              title="Облачное хранение"
              description="Безопасное хранение записей в облаке с доступом в любое время"
            />
            <FeatureCard 
              icon={<FaMobileAlt className="text-blue-500 text-3xl" />}
              title="Мобильный доступ"
              description="Управление системой с любого устройства через мобильное приложение"
            />
            <FeatureCard 
              icon={<FaChartLine className="text-blue-500 text-3xl" />}
              title="Аналитика данных"
              description="Искусственный интеллект для распознавания объектов и анализа поведения"
            />
            <FeatureCard 
              icon={<FaPlug className="text-blue-500 text-3xl" />}
              title="Интеграция с устройствами"
              description="Подключение любых камер Hikvision и совместимых устройств"
            />
          </div>
        </div>
      </section>

      {/* Как это работает */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Простое подключение
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Начните использовать систему за 3 простых шага
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="text-center max-w-xs">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Подключите камеры</h3>
              <p className="text-gray-600">
                Подключите камеры Hikvision к сети. Система автоматически их обнаружит.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="w-20 h-1 bg-blue-400 mx-auto"></div>
            </div>

            <div className="text-center max-w-xs">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">Настройте систему</h3>
              <p className="text-gray-600">
                Через простой интерфейс настройте зоны наблюдения и правила оповещений.
              </p>
            </div>

            <div className="hidden md:block">
              <div className="w-20 h-1 bg-blue-400 mx-auto"></div>
            </div>

            <div className="text-center max-w-xs">
              <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">Мониторинг и контроль</h3>
              <p className="text-gray-600">
                Наблюдайте за объектами в реальном времени и получайте уведомления.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Отзывы */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Что говорят наши клиенты
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Более 500 компаний доверяют нам свою безопасность
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard 
              name="Александр Петров"
              position="Директор, Торговый центр 'Сити Молл'"
              content="Система полностью изменила наше отношение к безопасности. Теперь мы контролируем всю территорию 24/7 с любого устройства."
              rating={5}
            />
            <TestimonialCard 
              name="Елена Смирнова"
              position="Владелец сети ресторанов"
              content="Простота настройки и интеграции с нашими существующими камерами. Техподдержка всегда на связи и помогает решить любые вопросы."
              rating={5}
            />
            <TestimonialCard 
              name="Дмитрий Иванов"
              position="Генеральный директор, Промышленный комплекс"
              content="Аналитические функции системы помогли оптимизировать рабочие процессы и повысить безопасность на производстве."
              rating={4}
            />
          </div>
        </div>
      </section>

      {/* CTA секция */}
      <section className="py-20 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Готовы начать?
          </h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto">
            Подключите систему видеонаблюдения уже сегодня и получите первый месяц обслуживания бесплатно
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/contact" 
              className="bg-transparent border-2 border-white hover:bg-white/10 font-bold py-4 px-10 rounded-lg text-lg transition duration-300"
            >
              Запросить демо
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}