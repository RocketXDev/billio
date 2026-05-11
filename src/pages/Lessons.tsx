import { useState } from "react";
import {
  FaHome,
  FaBars,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaUsers,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaList,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";

function Lessons() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showAddLesson, setShowAddLesson] = useState(false);

  const lessons = [
    {
      id: 1,
      student: "Anna Petrova",
      type: "Freestyle",
      dateLabel: "Tomorrow",
      date: "May 9",
      time: "10:00 AM",
      duration: "45 min",
      place: "World Ice Arena",
      status: "scheduled",
      rate: "$75",
    },
    {
      id: 2,
      student: "Maya Chen",
      type: "Spins",
      dateLabel: "This Week",
      date: "May 11",
      time: "11:30 AM",
      duration: "30 min",
      place: "Summit Rink",
      status: "scheduled",
      rate: "$50",
    },
    {
      id: 3,
      student: "Alex Kim",
      type: "Jumps",
      dateLabel: "5/9",
      date: "May 9",
      time: "2:00 PM",
      duration: "60 min",
      place: "World Ice Arena",
      status: "completed",
      rate: "$100",
    },
  ];

  const groupedLessons = lessons.reduce((groups: any, lesson) => {
    if (!groups[lesson.dateLabel]) {
      groups[lesson.dateLabel] = [];
    }

    groups[lesson.dateLabel].push(lesson);
    return groups;
  }, {});

  return (
    <div className="lessons-page">
      <div className="lessons-wrapper">
        <div className="lessons-body">
            <div className="lessons-header">
                <div className="lessons-header-add">
                    <h1>Lessons</h1>
                    <button
                        type="button"
                        className="lessons-add-btn"
                        onClick={() => setShowAddLesson(true)}
                    >
                        <FaPlus />
                    </button>
                </div>
            </div>
            <div className="lessons-view-toggle">
            <div
                className={`lessons-toggle-slider ${
                viewMode === "calendar" ? "lessons-toggle-slider-right" : ""
                }`}
            />

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
            >
                <FaList />
                List
            </button>

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
            >
                <FaCalendarAlt />
                Calendar
            </button>
            </div>

            {viewMode === "list" && (
            <div className="lessons-list-view">
                {Object.keys(groupedLessons).map((group) => (
                <section key={group} className="lesson-group">
                    <div className="lesson-group-title">
                    <h2>{group}</h2>
                    <span>{groupedLessons[group].length} lessons</span>
                    </div>

                    <div className="lesson-group-card">
                    {groupedLessons[group].map((lesson: any) => (
                        <div key={lesson.id} className="lesson-page-row">
                        <div className="lesson-page-time">
                            <strong>{lesson.time}</strong>
                            <span>{lesson.date}</span>
                        </div>

                        <div className="lesson-page-info">
                            <strong>{lesson.student}</strong>
                            <span>{lesson.type} • {lesson.duration}</span>
                            <span>
                            <FaMapMarkerAlt /> {lesson.place}
                            </span>
                        </div>

                        <div
                            className={`lesson-page-status ${lesson.status}`}
                        >
                            {lesson.status}
                        </div>
                        </div>
                    ))}
                    </div>
                </section>
                ))}
            </div>
            )}

            {viewMode === "calendar" && (
            <div className="calendar-view">
                <div className="calendar-top">
                <button type="button">
                    <FaChevronLeft />
                </button>

                <h2>May 2026</h2>

                <button type="button">
                    <FaChevronRight />
                </button>
                </div>

                <div className="calendar-days">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <span key={day}>{day}</span>
                ))}
                </div>

                <div className="calendar-grid">
                {[7, 8, 9, 10, 11, 12, 13].map((date) => (
                    <div
                    key={date}
                    className={`calendar-day-card ${
                        date === 9 ? "active" : ""
                    }`}
                    >
                    <strong>{date}</strong>

                    {date === 9 && (
                        <>
                        <div className="calendar-lesson-dot purple-dot" />
                        <p>2 lessons</p>
                        </>
                    )}

                    {date === 11 && (
                        <>
                        <div className="calendar-lesson-dot orange-dot" />
                        <p>1 lesson</p>
                        </>
                    )}
                    </div>
                ))}
                </div>

                <section className="calendar-detail-card">
                <h3>May 9</h3>

                <div className="calendar-detail-row">
                    <div className="calendar-time-icon">
                    <FaClock />
                    </div>

                    <div>
                    <strong>Anna Petrova</strong>
                    <span>10:00 AM • Freestyle • 45 min</span>
                    </div>
                </div>

                <div className="calendar-detail-row">
                    <div className="calendar-time-icon">
                    <FaClock />
                    </div>

                    <div>
                    <strong>Alex Kim</strong>
                    <span>2:00 PM • Jumps • 60 min</span>
                    </div>
                </div>
                </section>
            </div>
            )}
        </div>

        <nav className="bottom-nav" onClick={() => (window.location.href = "/dashboard")}>
            <div className="nav-item">
                <FaHome />
                <span>Dashboard</span>
            </div>
    
            <div className="nav-item active" onClick={() => (window.location.href = "/lessons")}>
                <FaCalendarAlt />
                <span>Lessons</span>
            </div>
    
                <div className="nav-item">
                <FaUsers />
                <span>Students</span>
            </div>
    
            <div className="nav-item">
                <FaFileInvoiceDollar />
                <span>Invoices</span>
            </div>
    
            <div className="nav-item">
                <FaEllipsisH />
                <span>More</span>
            </div>
        </nav>
      </div>

      {showAddLesson && (
        <div className="add-lesson-overlay">
          <div className="add-lesson-sheet">
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={() => setShowAddLesson(false)}>
                ×
              </button>
            </div>

            <form className="add-lesson-form">
              <div className="input-block">
                <label>Student</label>
                <input type="text" placeholder="Student name" />
              </div>

              <div className="input-block">
                <label>Date</label>
                <input type="date" />
              </div>

              <div className="input-block">
                <label>Time</label>
                <input type="time" />
              </div>

              <div className="duration-options">
                <button type="button">20 min</button>
                <button type="button">30 min</button>
                <button type="button">45 min</button>
                <button type="button">60 min</button>
              </div>

              <div className="input-block">
                <label>Lesson Type</label>
                <input type="text" placeholder="Freestyle, jumps, choreography..." />
              </div>

              <div className="input-block">
                <label>Place</label>
                <input type="text" placeholder="World Ice Arena" />
              </div>

              <button type="button" className="save-lesson-btn">
                Save Lesson
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lessons;