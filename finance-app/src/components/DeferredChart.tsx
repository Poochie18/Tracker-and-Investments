import { useEffect, useState, type ReactNode } from 'react'

// Recharts' ResponsiveContainer вимірює розмір свого DOM-вузла синхронно
// на ПЕРШОМУ рендері — до того, як браузер закомітив layout щойно
// змонтованого flex/grid-дерева. Той перший вимір іноді повертає 0 або -1,
// звідси нешкідливе, але шумне попередження в консолі ("The width(-1) and
// height(-1) of chart should be greater than 0..."). Сам графік після
// цього все одно домальовується правильно на наступному кадрі — але
// відклавши монтування ResponsiveContainer на один ефект (тобто вже ПІСЛЯ
// того, як layout усталився), хибний перший вимір не трапляється взагалі.
//
// Батьківський контейнер має власну фіксовану висоту (той самий height,
// що передається в ResponsiveContainer) — щоб цей один кадр очікування не
// призводив до "стрибка" розкладки.
export function DeferredChart({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // Легітимний виняток — синхронізація з зовнішнім сигналом (браузер
    // закомітив layout), саме те, для чого й призначені ефекти; тут
    // немає способу дізнатись про "layout committed" інакше, ніж ефектом.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true)
  }, [])
  return ready ? <>{children}</> : null
}
